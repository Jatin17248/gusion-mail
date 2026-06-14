import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  encodeRawEmail,
  extractBodyFromPayload,
  getHeader,
} from "@/server/lib/email";
import { getTenant } from "@/server/lib/tenant";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  dedupeByEntityId,
  sortMessagesNewestFirst,
  messageTimestamp,
} from "@/server/lib/corsair-entities";
import { redis } from "@/server/lib/redis";
import { ratelimit } from "@/server/lib/ratelimit";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

interface MappedMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  timestamp: number;
}

interface MessageDetails {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  snippet: string;
  date: string | null;
}

function mapMessage(message: {
  entity_id: string;
  data: {
    threadId?: string;
    snippet?: string;
    subject?: string;
    from?: string;
    to?: string;
    body?: string;
    internalDate?: string;
    createdAt?: Date | null;
  };
}): MappedMessage {
  return {
    id: message.entity_id,
    threadId: message.data.threadId ?? "",
    snippet: message.data.snippet ?? "",
    subject: message.data.subject ?? "",
    from: message.data.from ?? "",
    to: message.data.to ?? "",
    date: message.data.internalDate ?? null,
    timestamp: messageTimestamp(
      message.data.internalDate,
      message.data.createdAt,
    ),
  };
}

export const gmailRouter = createTRPCRouter({
  searchEmails: protectedProcedure
    .input(
      paginationSchema.extend({
        query: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = `gmail:inbox:${ctx.session.user.id}:${input.limit}:${input.offset}`;
      const isQueryEmpty = !input.query.trim();

      if (isQueryEmpty) {
        const cached = await redis.get(cacheKey) as MappedMessage[] | null;
        if (cached) return cached;
      }

      const tenant = getTenant(ctx.session.user.corsairTenantId);

      const messages = !isQueryEmpty
        ? await tenant.gmail.db.messages.search({
            data: {
              snippet: { contains: input.query },
            },
            limit: input.limit,
            offset: input.offset,
          })
        : await tenant.gmail.db.messages.list({
            limit: input.limit,
            offset: input.offset,
          });

      const result = sortMessagesNewestFirst(
        dedupeByEntityId(messages).map(mapMessage),
      );

      if (isQueryEmpty) {
        await redis.set(cacheKey, result, { ex: 60 });
      }

      return result;
    }),

  getMessage: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `gmail:message:${ctx.session.user.id}:${input.id}`;
      const cached = await redis.get(cacheKey) as MessageDetails | null;
      if (cached) return cached;

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const dbMessage = await tenant.gmail.db.messages.findByEntityId(input.id);

      if (dbMessage?.data.body || dbMessage?.data.subject) {
        const result: MessageDetails = {
          id: dbMessage.entity_id,
          threadId: dbMessage.data.threadId ?? "",
          subject: dbMessage.data.subject ?? "",
          from: dbMessage.data.from ?? "",
          to: dbMessage.data.to ?? "",
          body: dbMessage.data.body ?? dbMessage.data.snippet ?? "",
          snippet: dbMessage.data.snippet ?? "",
          date: dbMessage.data.internalDate ?? null,
        };
        await redis.set(cacheKey, result, { ex: 300 });
        return result;
      }

      try {
        const message = await tenant.gmail.api.messages.get({
          id: input.id,
          format: "full",
        });

        const headers = message.payload?.headers;
        const body =
          extractBodyFromPayload(message.payload) ??
          message.snippet ??
          "";

        const result: MessageDetails = {
          id: message.id ?? input.id,
          threadId: message.threadId ?? "",
          subject: getHeader(headers, "Subject"),
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          body,
          snippet: message.snippet ?? "",
          date:
            message.internalDate != null ? String(message.internalDate) : null,
        };
        await redis.set(cacheKey, result, { ex: 300 });
        return result;
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

  listDrafts: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const drafts = await tenant.gmail.db.drafts.list({
        limit: input.limit,
        offset: input.offset,
      });

      return dedupeByEntityId(drafts).map((draft) => ({
        id: draft.entity_id,
        messageId: draft.data.messageId ?? "",
        createdAt: draft.data.createdAt ?? null,
      }));
    }),

  refreshInbox: protectedProcedure.mutation(async ({ ctx }) => {
    const tenant = getTenant(ctx.session.user.corsairTenantId);
    try {
      const result = await tenant.gmail.api.threads.list({ maxResults: 50 });
      // Invalidate inbox cache
      const cacheKey = `gmail:inbox:${ctx.session.user.id}:${50}:${0}`;
      await redis.del(cacheKey);

      return {
        synced: result.threads?.length ?? 0,
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
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`gmail:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const raw = encodeRawEmail(input);
      const draft = await tenant.gmail.api.drafts.create({
        draft: { message: { raw } },
      });
      return {
        id: draft.id ?? "",
        messageId: draft.message?.id ?? "",
      };
    }),

  sendDraft: protectedProcedure
    .input(z.object({ draftId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`gmail:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const message = await tenant.gmail.api.drafts.send({ id: input.draftId });

      // Invalidate inbox cache
      await redis.del(`gmail:inbox:${ctx.session.user.id}:${50}:${0}`);

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? "",
      };
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`gmail:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });
      const viralSignatureEnabled = user?.viralSignatureEnabled ?? true;
      const body = viralSignatureEnabled
        ? `${input.body}\n\n--\nSent with Gusion Mail - https://mail.gusion.in`
        : input.body;

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const raw = encodeRawEmail({
        ...input,
        body,
      });
      const message = await tenant.gmail.api.messages.send({ raw });

      // Invalidate inbox cache
      await redis.del(`gmail:inbox:${ctx.session.user.id}:${50}:${0}`);

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? "",
      };
    }),

  replyToEmail: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        threadId: z.string().min(1),
        inReplyTo: z.string().min(1),
        references: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`gmail:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });
      const viralSignatureEnabled = user?.viralSignatureEnabled ?? true;
      const body = viralSignatureEnabled
        ? `${input.body}\n\n--\nSent with Gusion Mail - https://mail.gusion.in`
        : input.body;

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const raw = encodeRawEmail({
        to: input.to,
        subject: input.subject.startsWith("Re: ") ? input.subject : `Re: ${input.subject}`,
        body,
        inReplyTo: input.inReplyTo,
        references: input.references ? `${input.references} ${input.inReplyTo}` : input.inReplyTo,
      });

      const message = await tenant.gmail.api.messages.send({
        raw,
        threadId: input.threadId,
      });

      // Invalidate inbox cache
      await redis.del(`gmail:inbox:${ctx.session.user.id}:${50}:${0}`);

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? "",
      };
    }),

  archiveEmail: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const tenant = getTenant(ctx.session.user.corsairTenantId);
      await tenant.gmail.api.messages.modify({
        id: input.id,
        removeLabelIds: ["INBOX"],
      });

      // Invalidate cache
      await redis.del(`gmail:inbox:${ctx.session.user.id}:${50}:${0}`);
      await redis.del(`gmail:message:${ctx.session.user.id}:${input.id}`);

      return { success: true };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1), read: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const tenant = getTenant(ctx.session.user.corsairTenantId);
      if (input.read) {
        await tenant.gmail.api.messages.modify({
          id: input.id,
          removeLabelIds: ["UNREAD"],
        });
      } else {
        await tenant.gmail.api.messages.modify({
          id: input.id,
          addLabelIds: ["UNREAD"],
        });
      }

      // Invalidate cache
      await redis.del(`gmail:inbox:${ctx.session.user.id}:${50}:${0}`);
      await redis.del(`gmail:message:${ctx.session.user.id}:${input.id}`);

      return { success: true };
    }),
});
