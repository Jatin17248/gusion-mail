import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  encodeRawEmail,
  extractBodyFromPayload,
  getHeader,
} from "@/server/lib/email";
import { getTenant } from "@/server/lib/tenant";
import { provisionCorsairTenant } from "@/server/lib/corsair-setup";
import { env } from "@/env";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  dedupeByEntityId,
  sortMessagesNewestFirst,
  messageTimestamp,
} from "@/server/lib/corsair-entities";
import { redis } from "@/server/lib/redis";
import { ratelimit } from "@/server/lib/ratelimit";
import { db } from "@/server/db";
import { users, emailMeta, sendQueue, followUps, corsairEntities } from "@/server/db/schema";
import { eq, and, or, inArray, ne, desc, isNull, sql } from "drizzle-orm";

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
    internalDate?: string | null;
    createdAt?: Date | null;
    // Raw Gmail API shape — Corsair may store the full API response
    payload?: { headers?: { name?: string; value?: string }[] };
  };
}): MappedMessage {
  const headers = message.data.payload?.headers;
  // Prefer top-level fields (set by webhook pipeline); fall back to
  // payload.headers (raw Gmail API response stored by the SDK).
  const subject = message.data.subject || getHeader(headers, "Subject");
  const from    = message.data.from    || getHeader(headers, "From");
  const to      = message.data.to      || getHeader(headers, "To");

  const rawDate = message.data.internalDate ?? null;

  return {
    id: message.entity_id,
    threadId: message.data.threadId ?? "",
    snippet: message.data.snippet ?? "",
    subject,
    from,
    to,
    date: rawDate,
    timestamp: messageTimestamp(rawDate ?? undefined, message.data.createdAt),
  };
}

export const gmailRouter = createTRPCRouter({
  searchEmails: protectedProcedure
    .input(
      paginationSchema.extend({
        query: z.string(),
        tab: z.enum(["important", "other", "vip", "all"]).optional().default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cacheKey = `gmail:inbox:${ctx.session.user.id}:${input.tab}:${input.limit}:${input.offset}`;
      const isQueryEmpty = !input.query.trim();

      if (isQueryEmpty) {
        const cached = await redis.get(cacheKey) as (MappedMessage & { priority?: string; category?: string })[] | null;
        if (cached) return cached;
      }

      let tenant;
      try {
        tenant = getTenant(ctx.session.user.corsairTenantId);
      } catch {
        // No Corsair tenant yet — return empty inbox rather than throwing
        return [];
      }

      let result: MappedMessage[] = [];

      try {
        if (isQueryEmpty) {
          if (input.tab === "all") {
            const messages = await tenant.gmail.db.messages.list({
              limit: input.limit,
              offset: input.offset,
            });
            result = sortMessagesNewestFirst(
              dedupeByEntityId(messages)
                .map(mapMessage)
                .filter((m) => !!(m.from || m.subject || m.snippet)),
            );
          } else {
            let whereClause;
            if (input.tab === "important") {
              whereClause = and(
                eq(emailMeta.userId, ctx.session.user.id),
                or(
                  inArray(emailMeta.priority, ["urgent", "high"]),
                  eq(emailMeta.category, "important")
                )
              );
            } else if (input.tab === "other") {
              whereClause = and(
                eq(emailMeta.userId, ctx.session.user.id),
                or(
                  inArray(emailMeta.priority, ["normal", "low"]),
                  eq(emailMeta.category, "other")
                ),
                ne(emailMeta.isVipSender, true)
              );
            } else {
              // vip
              whereClause = and(
                eq(emailMeta.userId, ctx.session.user.id),
                eq(emailMeta.isVipSender, true)
              );
            }

            const metas = await db.query.emailMeta.findMany({
              where: whereClause,
              orderBy: [desc(emailMeta.createdAt)],
              limit: input.limit,
              offset: input.offset,
            });

            if (metas.length === 0) {
              return [];
            }

            const messageIds = metas.map((m) => m.gmailMessageId);
            const messages = await tenant.gmail.db.messages.findManyByEntityIds(messageIds);
            result = sortMessagesNewestFirst(
              dedupeByEntityId(messages).map(mapMessage),
            );
          }
        } else {
          const messages = await tenant.gmail.db.messages.search({
            data: {
              snippet: { contains: input.query },
            },
            limit: input.limit,
            offset: input.offset,
          });
          result = sortMessagesNewestFirst(
            dedupeByEntityId(messages).map(mapMessage),
          );
        }
      } catch (err) {
        // Entity cache unavailable (Corsair account not provisioned yet, DB cold start, etc.)
        console.error("[searchEmails] entity cache error:", err);
        return [];
      }

      // Join emailMeta
      const returnedIds = result.map((m) => m.id);
      const metas = returnedIds.length > 0
        ? await db.query.emailMeta.findMany({
            where: and(
              eq(emailMeta.userId, ctx.session.user.id),
              inArray(emailMeta.gmailMessageId, returnedIds)
            ),
          })
        : [];

      const metaMap = new Map(metas.map((m) => [m.gmailMessageId, m]));

      const finalResult = result.map((m) => {
        const meta = metaMap.get(m.id);
        return {
          ...m,
          priority: meta?.priority ?? "normal",
          category: meta?.category ?? "other",
        };
      });

      // Filter out snoozed emails from active lists
      const activeResult = finalResult.filter((m) => {
        const meta = metaMap.get(m.id);
        return meta?.isSnoozed !== true;
      });

      // Filter search results in-memory by tab if search query is active
      let filteredResult = activeResult;
      if (!isQueryEmpty && input.tab !== "all") {
        filteredResult = activeResult.filter((m) => {
          if (input.tab === "important") {
            return m.priority === "urgent" || m.priority === "high" || m.category === "important";
          } else if (input.tab === "other") {
            const meta = metaMap.get(m.id);
            return (m.priority === "normal" || m.priority === "low" || m.category === "other") && meta?.isVipSender !== true;
          } else if (input.tab === "vip") {
            const meta = metaMap.get(m.id);
            return meta?.isVipSender === true;
          }
          return true;
        });
      }

      if (isQueryEmpty) {
        await redis.set(cacheKey, filteredResult, { ex: 60 });
      }

      return filteredResult;
    }),

  getMessage: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const cacheKey = `gmail:message:${ctx.session.user.id}:${input.id}`;
      const cached = await redis.get(cacheKey) as MessageDetails | null;
      if (cached) return cached;

      const tenant = getTenant(ctx.session.user.corsairTenantId);

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
      // Always push the latest OAuth tokens from NextAuth's accounts table into
      // Corsair's key manager. Access tokens expire in 1h; without this step,
      // syncs silently return 0 once the token provisioned at sign-up goes stale.
      if (ctx.session.user.corsairTenantId) {
        try {
          // provisionCorsairTenant re-encrypts both integration credentials
          // (client_id/client_secret) AND account tokens on every sync, ensuring
          // keyBuilder never fails due to stale plaintext or rotated DEKs.
          await provisionCorsairTenant(
            ctx.session.user.id,
            ctx.session.user.corsairTenantId,
            env.CORSAIR_KEK,
          );
        } catch (provisionErr) {
          const msg = provisionErr instanceof Error ? provisionErr.message : String(provisionErr);
          if (msg.includes("No Google OAuth credentials")) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Google account connection is invalid. Please reconnect.",
            });
          }
          throw provisionErr;
        }
      }

      // Clean up any incomplete cached email messages (missing subject)
      // to force them to be fetched freshly using the full format
      await db.delete(corsairEntities)
        .where(
          and(
            eq(corsairEntities.entityType, "messages"),
            or(
              isNull(sql`data->>'subject'`),
              eq(sql`data->>'subject'`, "")
            )
          )
        );

      // Fetch recent message IDs from Gmail inbox
      const listResult = await tenant.gmail.api.messages.list({
        maxResults: 50,
        labelIds: ["INBOX"],
      });
      const msgList = (listResult.messages ?? []).slice(0, 30) as { id?: string }[];

      // Fetch each message. The SDK's messages.get auto-caches entity data
      // (including subject/from/to extracted from headers) via the entity
      // repository before returning. We don't do a separate upsert — that
      // would overwrite the SDK's data with a partial copy that may be missing
      // fields if header extraction fails.
      let synced = 0;
      for (const msg of msgList) {
        if (!msg.id) continue;
        try {
          await tenant.gmail.api.messages.get({
            id: msg.id,
            format: "full",
          });
          synced++;
        } catch (msgErr: unknown) {
          // Re-throw auth errors so the outer catch handles them properly
          const errCode = msgErr && typeof msgErr === "object" && "code" in msgErr
            ? (msgErr as { code: number }).code : null;
          if (errCode === 401 || errCode === 403) throw msgErr;
          const errStatus = msgErr && typeof msgErr === "object" && "status" in msgErr
            ? (msgErr as { status: number }).status : null;
          if (errStatus === 401 || errStatus === 403) throw msgErr;
          // Non-auth per-message failures: skip and continue
        }
      }

      // Invalidate all inbox cache entries for this user (cover common limit values)
      const tabs = ["important", "other", "vip", "all"];
      const limits = [30, 50, 100];
      const cachePatterns = tabs.flatMap((tab) =>
        limits.map((limit) => `gmail:inbox:${ctx.session.user.id}:${tab}:${limit}:0`)
      );
      await Promise.all(cachePatterns.map((k) => redis.del(k)));

      return { synced };
    } catch (error: unknown) {
      // GmailAPIError uses `code` (not `status`)
      if (error && typeof error === "object" && "code" in error) {
        const code = (error as { code: number }).code;
        if (code === 401 || code === 403) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Google account connection is invalid. Please reconnect." });
        }
      }
      // Fallback for HTTP errors that expose `status`
      if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status: number }).status;
        if (status === 401 || status === 403) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Google account connection is invalid. Please reconnect." });
        }
      }
      // Re-throw TRPC errors as-is (e.g. the hasOAuth check above)
      if (error instanceof TRPCError) throw error;
      // Corsair keyBuilder auth failures, missing account/integration records, and
      // DEK decryption failures (CORSAIR_KEK mismatch → "Invalid encrypted data format")
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes("[corsair:gmail]") ||
        msg.includes("[auth-missing:") ||
        msg.includes("refresh_token") ||
        msg.includes("refresh token") ||
        msg.includes("Account not found for tenant") ||
        msg.includes("Invalid encrypted data format") ||
        msg.includes("encrypted data") ||
        msg.includes("unable to authenticate") ||
        msg.includes("Unsupported state") ||
        (msg.includes("Integration") && msg.includes("not found"))
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Google account connection is invalid. Please reconnect." });
      }
      // Transient/non-auth errors (rate limit, network, etc.) — log and return gracefully
      console.error("[refreshInbox] unexpected error:", error);
      return { synced: 0 };
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

      if (ctx.session.user.corsairTenantId) {
        await provisionCorsairTenant(ctx.session.user.id, ctx.session.user.corsairTenantId, env.CORSAIR_KEK);
      }
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

  snoozeEmail: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        snoozeUntil: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenant = getTenant(ctx.session.user.corsairTenantId);
      
      // Archive from inbox first
      await tenant.gmail.api.messages.modify({
        id: input.id,
        removeLabelIds: ["INBOX"],
      });

      // Find or create email meta record
      const existing = await db.query.emailMeta.findFirst({
        where: and(
          eq(emailMeta.userId, ctx.session.user.id),
          eq(emailMeta.gmailMessageId, input.id)
        ),
      });

      if (existing) {
        await db
          .update(emailMeta)
          .set({
            isSnoozed: true,
            snoozeUntil: input.snoozeUntil,
            updatedAt: new Date(),
          })
          .where(eq(emailMeta.id, existing.id));
      } else {
        const dbMessage = await tenant.gmail.db.messages.findByEntityId(input.id);
        await db.insert(emailMeta).values({
          userId: ctx.session.user.id,
          gmailMessageId: input.id,
          threadId: dbMessage?.data.threadId ?? "",
          isSnoozed: true,
          snoozeUntil: input.snoozeUntil,
        });
      }

      // Invalidate cache
      await redis.del(`gmail:inbox:${ctx.session.user.id}:all:${50}:${0}`);
      await redis.del(`gmail:inbox:${ctx.session.user.id}:important:${50}:${0}`);
      await redis.del(`gmail:inbox:${ctx.session.user.id}:other:${50}:${0}`);
      await redis.del(`gmail:inbox:${ctx.session.user.id}:vip:${50}:${0}`);
      await redis.del(`gmail:message:${ctx.session.user.id}:${input.id}`);

      return { success: true };
    }),

  scheduleSend: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        sendAt: z.date(),
        threadId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });
      const viralSignatureEnabled = user?.viralSignatureEnabled ?? true;
      const body = viralSignatureEnabled
        ? `${input.body}\n\n--\nSent with Gusion Mail - https://mail.gusion.in`
        : input.body;

      const raw = encodeRawEmail({
        to: input.to,
        subject: input.subject,
        body,
      });

      await db.insert(sendQueue).values({
        userId: ctx.session.user.id,
        rawBase64Url: raw,
        threadId: input.threadId ?? null,
        sendAt: input.sendAt,
        status: "pending",
      });

      return { success: true };
    }),

  createFollowUp: protectedProcedure
    .input(
      z.object({
        threadId: z.string().min(1),
        sentMessageId: z.string().min(1),
        remindAt: z.date(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.insert(followUps).values({
        userId: ctx.session.user.id,
        threadId: input.threadId,
        sentMessageId: input.sentMessageId,
        remindAt: input.remindAt,
        reason: input.reason ?? "No reply",
        status: "pending",
      });

      return { success: true };
    }),
});
