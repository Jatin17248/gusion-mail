import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { hasActivePlanOrTrial } from "@/server/lib/plan-gate";
import { db } from "@/server/db";
import { schedulingLinks, bookings, users } from "@/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getTenant } from "@/server/lib/tenant";

export const schedulingRouter = createTRPCRouter({
  createLink: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        durationMins: z.number().min(5),
        bufferMins: z.number().default(0),
        availability: z
          .object({
            timeZone: z.string().default("UTC"),
            startTime: z.string().default("09:00"),
            endTime: z.string().default("17:00"),
            days: z.array(z.number()).default([1, 2, 3, 4, 5]), // Monday to Friday
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isPremium = await hasActivePlanOrTrial(ctx.session.user.id);
      if (!isPremium) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This feature requires a premium plan or an active 14-day trial.",
        });
      }

      // Check unique slug
      const existing = await db.query.schedulingLinks.findFirst({
        where: eq(schedulingLinks.slug, input.slug),
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Slug already exists. Please choose a different one.",
        });
      }

      const defaultAvailability = {
        timeZone: "UTC",
        startTime: "09:00",
        endTime: "17:00",
        days: [1, 2, 3, 4, 5],
      };

      const [link] = await db
        .insert(schedulingLinks)
        .values({
          userId: ctx.session.user.id,
          title: input.title,
          slug: input.slug.toLowerCase(),
          durationMins: input.durationMins,
          bufferMins: input.bufferMins,
          availability: JSON.stringify(input.availability ?? defaultAvailability),
          isActive: true,
        })
        .returning();

      return link;
    }),

  listLinks: protectedProcedure.query(async ({ ctx }) => {
    return await db.query.schedulingLinks.findMany({
      where: eq(schedulingLinks.userId, ctx.session.user.id),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
    });
  }),

  toggleLink: protectedProcedure
    .input(z.object({ id: z.string().min(1), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(schedulingLinks)
        .set({ isActive: input.isActive })
        .where(and(eq(schedulingLinks.id, input.id), eq(schedulingLinks.userId, ctx.session.user.id)))
        .returning();

      return updated;
    }),

  getPublicAvailability: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
    )
    .query(async ({ input }) => {
      const link = await db.query.schedulingLinks.findFirst({
        where: eq(schedulingLinks.slug, input.slug.toLowerCase()),
      });

      if (!link?.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduling link not found or inactive.",
        });
      }

      const hostPremium = await hasActivePlanOrTrial(link.userId);
      if (!hostPremium) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This scheduling link is currently unavailable.",
        });
      }

      const host = await db.query.users.findFirst({
        where: eq(users.id, link.userId),
      });

      if (!host?.corsairTenantId || !host.calendarConnected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Host calendar is not connected.",
        });
      }

      // Parse availability config
      type AvailabilityConfig = {
        timeZone: string;
        startTime: string;
        endTime: string;
        days: number[];
      };
      const config: AvailabilityConfig = link.availability
        ? (JSON.parse(link.availability) as AvailabilityConfig)
        : { timeZone: "UTC", startTime: "09:00", endTime: "17:00", days: [1, 2, 3, 4, 5] };

      // Query Google Calendar events
      const tenant = getTenant(host.corsairTenantId);
      const calendarResult = await tenant.googlecalendar.api.events.getMany({
        calendarId: "primary",
        timeMin: input.startDate,
        timeMax: input.endDate,
        singleEvents: true,
      });

      const busyEvents = calendarResult.items?.map((item) => {
        const start = item.start?.dateTime ?? item.start?.date ?? "";
        const end = item.end?.dateTime ?? item.end?.date ?? "";
        return {
          start: new Date(start).getTime(),
          end: new Date(end).getTime(),
        };
      }) ?? [];

      // Query existing bookings from DB to avoid double booking
      const dbBookings = await db.query.bookings.findMany({
        where: and(
          eq(bookings.schedulingLinkId, link.id),
          gte(bookings.start, new Date(input.startDate)),
          lte(bookings.end, new Date(input.endDate))
        ),
      });

      const busyBookings = dbBookings.map((b) => ({
        start: new Date(b.start).getTime(),
        end: new Date(b.end).getTime(),
      }));

      const allBusy = [...busyEvents, ...busyBookings];

      // Generate slots
      const durationMs = link.durationMins * 60 * 1000;
      const bufferMs = (link.bufferMins ?? 0) * 60 * 1000;
      const slots: { start: string; end: string }[] = [];

      const startRange = new Date(input.startDate);
      const endRange = new Date(input.endDate);

      // Iterate day-by-day
      const current = new Date(startRange);
      while (current < endRange) {
        const dayOfWeek = current.getUTCDay();
        if (config.days.includes(dayOfWeek)) {
          // Parse start and end hours/minutes in UTC (or link timezone)
          const [startHour, startMin] = config.startTime.split(":").map(Number);
          const [endHour, endMin] = config.endTime.split(":").map(Number);

          const slotStartDay = new Date(Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth(),
            current.getUTCDate(),
            startHour ?? 9,
            startMin ?? 0,
            0,
            0
          ));

          const slotEndDay = new Date(Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth(),
            current.getUTCDate(),
            endHour ?? 17,
            endMin ?? 0,
            0,
            0
          ));

          let slotTime = slotStartDay.getTime();
          const dayEndTime = slotEndDay.getTime();

          while (slotTime + durationMs <= dayEndTime) {
            const candidateStart = slotTime;
            const candidateEnd = slotTime + durationMs;

            // Check overlap with busy times
            const hasOverlap = allBusy.some(
              (busy) => candidateStart < busy.end && candidateEnd > busy.start
            );

            // Check if slot starts in the past
            const isFuture = candidateStart > Date.now();

            if (!hasOverlap && isFuture) {
              slots.push({
                start: new Date(candidateStart).toISOString(),
                end: new Date(candidateEnd).toISOString(),
              });
            }

            slotTime += durationMs + bufferMs;
          }
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }

      return {
        link,
        hostName: host.name ?? "Host",
        slots,
      };
    }),

  createBooking: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        inviteeEmail: z.string().email(),
        inviteeName: z.string().min(1),
        slotStart: z.string().datetime(),
        slotEnd: z.string().datetime(),
      })
    )
    .mutation(async ({ input }) => {
      const link = await db.query.schedulingLinks.findFirst({
        where: eq(schedulingLinks.slug, input.slug.toLowerCase()),
      });

      if (!link?.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scheduling link not found or inactive.",
        });
      }

      const hostPremium = await hasActivePlanOrTrial(link.userId);
      if (!hostPremium) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This scheduling link is currently unavailable.",
        });
      }

      const host = await db.query.users.findFirst({
        where: eq(users.id, link.userId),
      });

      if (!host?.corsairTenantId || !host.calendarConnected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Host calendar is not connected.",
        });
      }

      const existingBooking = await db.query.bookings.findFirst({
        where: and(
          eq(bookings.schedulingLinkId, link.id),
          eq(bookings.start, new Date(input.slotStart))
        ),
      });

      if (existingBooking) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This slot is already booked.",
        });
      }

      // Schedule the Google Calendar invitation using host's plugin API
      const tenant = getTenant(host.corsairTenantId);
      const event = await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        sendUpdates: "all",
        event: {
          summary: `${link.title} - ${input.inviteeName}`,
          description: `Scheduled meeting via Gusion Mail.`,
          start: { dateTime: input.slotStart },
          end: { dateTime: input.slotEnd },
          attendees: [
            { email: input.inviteeEmail, displayName: input.inviteeName },
            { email: host.email ?? "", displayName: host.name ?? "" }
          ],
        },
      });

      // Insert booking record
      const [booking] = await db
        .insert(bookings)
        .values({
          schedulingLinkId: link.id,
          inviteeEmail: input.inviteeEmail,
          inviteeName: input.inviteeName,
          start: new Date(input.slotStart),
          end: new Date(input.slotEnd),
          calendarEventId: event.id ?? null,
        })
        .returning();

      return booking;
    }),
});
