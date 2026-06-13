import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getTenant } from "@/server/lib/tenant";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { dedupeByEntityId } from "@/server/lib/corsair-entities";
import { redis } from "@/server/lib/redis";
import { ratelimit } from "@/server/lib/ratelimit";

const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

interface MappedEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  status: string;
  start: string;
  end: string;
  attendees: string[];
  htmlLink: string;
  createdAt: Date | null;
  timestamp: number;
}

function eventStartTimestamp(event: {
  data: {
    start?: { date?: string; dateTime?: string };
  };
}): number {
  const start = event.data.start?.dateTime ?? event.data.start?.date;
  if (!start) return 0;
  return new Date(start).getTime();
}

function mapEvent(event: {
  entity_id: string;
  data: {
    summary?: string;
    description?: string;
    location?: string;
    status?: string;
    start?: { date?: string; dateTime?: string; timeZone?: string };
    end?: { date?: string; dateTime?: string; timeZone?: string };
    attendees?: { email?: string; displayName?: string }[];
    htmlLink?: string;
    createdAt?: Date | null;
  };
}): MappedEvent {
  return {
    id: event.entity_id,
    summary: event.data.summary ?? "",
    description: event.data.description ?? "",
    location: event.data.location ?? "",
    status: event.data.status ?? "",
    start: event.data.start?.dateTime ?? event.data.start?.date ?? "",
    end: event.data.end?.dateTime ?? event.data.end?.date ?? "",
    attendees:
      event.data.attendees
        ?.map((a) => {
          if (a.displayName && a.email) return `${a.displayName} <${a.email}>`;
          return a.email ?? a.displayName ?? "";
        })
        .filter(Boolean) ?? [],
    htmlLink: event.data.htmlLink ?? "",
    createdAt: event.data.createdAt ?? null,
    timestamp: eventStartTimestamp(event),
  };
}

function filterEventsByWeek<
  T extends { timestamp: number; start: string },
>(events: T[], weekStart: Date, weekEnd: Date): T[] {
  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();

  return events
    .filter((event) => {
      if (event.timestamp > 0) {
        return event.timestamp >= startMs && event.timestamp < endMs;
      }
      if (!event.start) return false;
      const ts = new Date(event.start).getTime();
      return ts >= startMs && ts < endMs;
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

export const calendarRouter = createTRPCRouter({
  searchEvents: protectedProcedure
    .input(
      paginationSchema.extend({
        query: z.string(),
        weekStart: z.string().datetime(),
        weekEnd: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = `calendar:events:${ctx.session.user.id}:${input.weekStart}:${input.weekEnd}`;
      const isQueryEmpty = !input.query.trim();

      if (isQueryEmpty) {
        const cached = await redis.get(cacheKey) as MappedEvent[] | null;
        if (cached) return cached;
      }

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const weekStart = new Date(input.weekStart);
      const weekEnd = new Date(input.weekEnd);

      const events = !isQueryEmpty
        ? await tenant.googlecalendar.db.events.search({
            data: {
              summary: { contains: input.query },
            },
            limit: 200,
            offset: 0,
          })
        : await tenant.googlecalendar.db.events.list({
            limit: 200,
            offset: 0,
          });

      const result = filterEventsByWeek(
        dedupeByEntityId(events).map(mapEvent),
        weekStart,
        weekEnd,
      );

      if (isQueryEmpty) {
        await redis.set(cacheKey, result, { ex: 60 });
      }

      return result;
    }),

  refreshEvents: protectedProcedure
    .input(
      z.object({
        weekStart: z.string().datetime(),
        weekEnd: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = getTenant(ctx.session.user.corsairTenantId);
      try {
        const result = await tenant.googlecalendar.api.events.getMany({
          calendarId: "primary",
          timeMin: input.weekStart,
          timeMax: input.weekEnd,
          maxResults: 100,
          singleEvents: true,
          orderBy: "startTime",
        });

        // Invalidate cache
        const cacheKey = `calendar:events:${ctx.session.user.id}:${input.weekStart}:${input.weekEnd}`;
        await redis.del(cacheKey);

        return {
          synced: result.items?.length ?? 0,
        };
      } catch (error: unknown) {
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status === 401 || status === 403) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Google account connection is invalid. Please reconnect.",
            });
          }
        }
        throw error;
      }
    }),

  createDraft: protectedProcedure
    .input(
      z.object({
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().datetime(),
        end: z.string().datetime(),
        attendees: z.array(z.string().email()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`calendar:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const event = await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        sendUpdates: "none",
        event: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          status: "tentative",
          start: { dateTime: input.start },
          end: { dateTime: input.end },
          attendees: input.attendees?.map((email) => ({ email })),
        },
      });

      // Invalidate caches
      await redis.del(`calendar:events:${ctx.session.user.id}`);

      return {
        id: event.id ?? "",
        htmlLink: event.htmlLink ?? "",
      };
    }),

  sendInvite: protectedProcedure
    .input(
      z.object({
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().datetime(),
        end: z.string().datetime(),
        attendees: z.array(z.string().email()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`calendar:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const event = await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        sendUpdates: "all",
        event: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.start },
          end: { dateTime: input.end },
          attendees: input.attendees.map((email) => ({ email })),
        },
      });

      // Invalidate caches
      await redis.del(`calendar:events:${ctx.session.user.id}`);

      return {
        id: event.id ?? "",
        htmlLink: event.htmlLink ?? "",
      };
    }),

  updateEvent: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string().datetime(),
        end: z.string().datetime(),
        attendees: z.array(z.string().email()).optional(),
        sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`calendar:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const event = await tenant.googlecalendar.api.events.update({
        id: input.id,
        calendarId: "primary",
        sendUpdates: input.sendUpdates,
        event: {
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: { dateTime: input.start },
          end: { dateTime: input.end },
          attendees: input.attendees?.map((email) => ({ email })),
        },
      });

      return {
        id: event.id ?? "",
        htmlLink: event.htmlLink ?? "",
      };
    }),

  deleteEvent: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`calendar:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      await tenant.googlecalendar.api.events.delete({
        id: input.id,
        calendarId: "primary",
        sendUpdates: input.sendUpdates,
      });

      return { success: true };
    }),
});
