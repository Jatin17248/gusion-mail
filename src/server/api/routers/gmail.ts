import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { google } from "googleapis";
import {
  encodeRawEmail,
  extractAttachmentsFromPayload,
  extractBodyFromPayload,
  getHeader,
  type EmailAttachment,
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
import { users, emailMeta, sendQueue, followUps, accounts } from "@/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

// Shared schema for outgoing attachments (base64-encoded client-side).
const outgoingAttachmentSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  data: z.string().min(1),
});

// Gmail caps total message size at 25MB. base64 inflates ~33%, so check the
// decoded size to fail fast with a friendly error instead of a Gmail 4xx.
function assertAttachmentsWithinLimit(
  attachments?: { data: string }[],
): void {
  if (!attachments?.length) return;
  const approxBytes = attachments.reduce(
    (sum, a) => sum + Math.ceil((a.data.length * 3) / 4),
    0,
  );
  if (approxBytes > 25 * 1024 * 1024) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Attachments exceed the 25MB limit.",
    });
  }
}

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
  messageId: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  snippet: string;
  date: string | null;
  attachments: EmailAttachment[];
}

// Cache-version key: bumped on any mutation that changes inbox membership, so
// every opaque-cursor inbox page is invalidated at once (cursor-keyed Redis
// entries can't be enumerated the way numeric offsets could).
const inboxVersionKey = (userId: string) => `gmail:inboxver:${userId}`;

async function getInboxVersion(userId: string): Promise<number> {
  try {
    return Number(await redis.get(inboxVersionKey(userId))) || 0;
  } catch {
    return 0;
  }
}

async function bumpInboxVersion(userId: string): Promise<void> {
  try {
    await redis.incr(inboxVersionKey(userId));
  } catch {
    // cache invalidation is best-effort
  }
}

// GmailAPIError exposes `code`; HTTP errors expose `status`.
function gmailErrorStatus(error: unknown): number | null {
  if (error && typeof error === "object") {
    const e = error as { status?: number; code?: number };
    return e.status ?? e.code ?? null;
  }
  return null;
}

function isGmailAuthError(error: unknown): boolean {
  const status = gmailErrorStatus(error);
  return status === 401 || status === 403;
}

function isGmailRateLimit(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    gmailErrorStatus(error) === 429 ||
    /rate.?limit|quota|userRateLimitExceeded|too many requests/i.test(msg)
  );
}

// Map a raw Gmail/SDK error to a typed TRPCError so the client can react
// (silently retry transient rate limits, prompt a reconnect on auth failures)
// instead of being handed an opaque empty inbox.
function toInboxError(error: unknown): TRPCError {
  if (isGmailAuthError(error)) {
    return new TRPCError({
      code: "UNAUTHORIZED",
      message: "Google account connection is invalid. Please reconnect.",
    });
  }
  if (isGmailRateLimit(error)) {
    return new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Gmail is rate limiting requests. Please retry shortly.",
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Couldn't load your inbox. Please retry.",
  });
}


type GmailClient = ReturnType<typeof google.gmail>;

// Build an authenticated Gmail client directly from the NextAuth accounts row.
// The googleapis OAuth2 client auto-refreshes the access token when it expires,
// so this is always reliable — unlike the Corsair SDK which has its own credential
// store that goes stale between JWT refreshes and JWT-level token updates.
async function buildGmailClient(userId: string): Promise<GmailClient | null> {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
  });
  if (!account?.access_token) return null;
  const oauth2Client = new google.auth.OAuth2(
    env.AUTH_GOOGLE_ID,
    env.AUTH_GOOGLE_SECRET,
  );
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

// Fetch Gmail metadata for a list of message IDs with per-message Redis caching.
// Uses the googleapis client directly (not the Corsair SDK) because the Corsair
// credential store goes stale and causes silent 30-second timeouts on every call.
// The googleapis OAuth2 client auto-refreshes the token, so calls are reliable.
async function fetchEmailMetadata(
  gmailClient: GmailClient,
  userId: string,
  ids: string[],
): Promise<{ rows: MappedMessage[]; failed: number }> {
  if (ids.length === 0) return { rows: [], failed: 0 };

  const CHUNK = 10;
  const results: (MappedMessage | null)[] = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK);
    const batchResults = await Promise.all(
      batch.map(async (id): Promise<MappedMessage | null> => {
        const msgMetaKey = `gmail:msgmeta:v2:${userId}:${id}`;
        const cachedMsg = (await redis.get(msgMetaKey)) as MappedMessage | null;
        if (cachedMsg) return cachedMsg;
        try {
          const res = await gmailClient.users.messages.get({
            userId: "me",
            id,
            format: "metadata",
          });
          const msg = res.data;
          const headers = (msg.payload?.headers ?? []) as {
            name?: string;
            value?: string;
          }[];
          const rawDate =
            msg.internalDate != null ? String(msg.internalDate) : null;
          const mapped: MappedMessage = {
            id: msg.id ?? id,
            threadId: msg.threadId ?? "",
            snippet: msg.snippet ?? "",
            subject: getHeader(headers, "Subject"),
            from: getHeader(headers, "From"),
            to: getHeader(headers, "To"),
            date: rawDate,
            timestamp: messageTimestamp(rawDate ?? undefined),
          };
          if (mapped.from || mapped.subject || mapped.snippet) {
            await redis.set(msgMetaKey, mapped, { ex: 300 });
          }
          return mapped;
        } catch {
          return null;
        }
      }),
    );
    results.push(...batchResults);
  }

  const failed = results.filter((r) => r === null).length;
  return {
    rows: sortMessagesNewestFirst(
      results.filter(
        (r): r is MappedMessage => r !== null && !!(r.from || r.subject || r.snippet),
      ),
    ),
    failed,
  };
}

// Build a Gmail search query for a tab + optional user search string.
function buildInboxQuery(
  tab: "important" | "other" | "vip" | "all",
  query: string,
): string {
  const parts: string[] = ["in:inbox"];
  const q = query.trim();
  if (q) parts.push(q);
  if (tab === "important") parts.push("(is:important OR is:starred)");
  else if (tab === "other") parts.push("-is:important -is:starred");
  return parts.join(" ");
}

export const gmailRouter = createTRPCRouter({
  searchEmails: protectedProcedure
    .input(
      z.object({
        query: z.string().default(""),
        tab: z.enum(["important", "other", "vip", "all"]).optional().default("all"),
        limit: z.number().min(1).max(100).default(25),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      type InboxRow = MappedMessage & { priority: string; category: string };
      const emptyPage: { items: InboxRow[]; nextCursor: string | null } = {
        items: [],
        nextCursor: null,
      };

      const ver = await getInboxVersion(userId);
      const cacheKey = `gmail:inbox:${userId}:v${ver}:${input.tab}:${input.limit}:${encodeURIComponent(
        input.query.trim(),
      )}:${input.cursor ?? "start"}`;

      const cached = (await redis.get(cacheKey)) as typeof emptyPage | null;
      if (cached) return cached;

      // Use googleapis directly so the OAuth2 client handles token refresh
      // automatically. The Corsair SDK credential store goes stale and causes
      // 30-second timeouts on every messages.get() call.
      const gmailClient = await buildGmailClient(userId);
      if (!gmailClient) {
        return emptyPage;
      }

      let rows: MappedMessage[] = [];
      let nextCursor: string | null = null;
      let fetchFailed = 0;

      try {
        if (input.tab === "vip") {
          // VIP is a small, user-curated set — query emailMeta directly and
          // return a single page (no Gmail cursor).
          const vipMetas = await db.query.emailMeta.findMany({
            where: and(
              eq(emailMeta.userId, userId),
              eq(emailMeta.isVipSender, true),
            ),
            limit: input.limit,
          });
          const fetched = await fetchEmailMetadata(
            gmailClient,
            userId,
            vipMetas.map((m) => m.gmailMessageId),
          );
          rows = fetched.rows;
          fetchFailed = fetched.failed;
        } else {
          const listRes = await gmailClient.users.messages.list({
            userId: "me",
            maxResults: input.limit,
            q: buildInboxQuery(input.tab, input.query),
            pageToken: input.cursor,
          });
          const ids = (listRes.data.messages ?? [])
            .map((m) => m.id)
            .filter((id): id is string => !!id);
          const fetched = await fetchEmailMetadata(gmailClient, userId, ids);
          rows = fetched.rows;
          fetchFailed = fetched.failed;
          nextCursor = listRes.data.nextPageToken ?? null;
        }
      } catch (err) {
        console.error("[searchEmails] Gmail error:", err);
        throw toInboxError(err);
      }

      // Join emailMeta for priority/category badges + snooze/VIP flags.
      const returnedIds = rows.map((m) => m.id);
      const metas =
        returnedIds.length > 0
          ? await db.query.emailMeta.findMany({
              where: and(
                eq(emailMeta.userId, userId),
                inArray(emailMeta.gmailMessageId, returnedIds),
              ),
            })
          : [];
      const metaMap = new Map(metas.map((m) => [m.gmailMessageId, m]));

      const items: InboxRow[] = rows
        .filter((m) => metaMap.get(m.id)?.isSnoozed !== true)
        // "other" excludes VIP senders (Gmail q already handled important/starred).
        .filter((m) =>
          input.tab === "other" ? metaMap.get(m.id)?.isVipSender !== true : true,
        )
        .map((m) => {
          const meta = metaMap.get(m.id);
          return {
            ...m,
            priority: meta?.priority ?? "normal",
            category: meta?.category ?? "other",
          };
        });

      const page = { items, nextCursor };
      // Skip caching if any individual message fetches failed (rate-limit or
      // transient error) so a degraded result doesn't pin the inbox for 60s.
      if (fetchFailed === 0) {
        await redis.set(cacheKey, page, { ex: 60 });
      }
      return page;
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
          messageId: getHeader(headers, "Message-ID"),
          subject: getHeader(headers, "Subject"),
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          body,
          snippet: message.snippet ?? "",
          date:
            message.internalDate != null ? String(message.internalDate) : null,
          attachments: extractAttachmentsFromPayload(message.payload),
        };
        await redis.set(cacheKey, result, { ex: 300 });
        return result;
      } catch (error: unknown) {
        // GmailAPIError exposes `code`; HTTP errors expose `status`.
        const statusCode =
          error && typeof error === "object"
            ? ((error as { status?: number; code?: number }).status ??
              (error as { status?: number; code?: number }).code ??
              null)
            : null;
        const message = error instanceof Error ? error.message : String(error);

        if (statusCode === 401 || statusCode === 403) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Google account connection is invalid. Please reconnect.",
          });
        }
        // Rate limiting: normalize so the client can fail silently (the
        // hover-prefetch can briefly burst these) instead of surfacing a raw
        // error in the dev overlay.
        if (
          statusCode === 429 ||
          /rate.?limit|quota|userRateLimitExceeded|too many requests/i.test(message)
        ) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Gmail is rate limiting requests. Please retry shortly.",
          });
        }
        throw error;
      }
    }),

  // Lazily fetch attachment bytes on demand (Gmail omits them from format=full).
  // Returns base64url data the client turns into a Blob for preview/download.
  getAttachment: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        attachmentId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.userId, ctx.session.user.id),
          eq(accounts.provider, "google"),
        ),
      });

      if (!account?.access_token) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Google account not connected.",
        });
      }

      const oauth2Client = new google.auth.OAuth2(
        env.AUTH_GOOGLE_ID,
        env.AUTH_GOOGLE_SECRET,
      );
      oauth2Client.setCredentials({
        access_token: account.access_token,
        refresh_token: account.refresh_token ?? undefined,
        expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
      });

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      try {
        const res = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: input.messageId,
          id: input.attachmentId,
        });
        return {
          data: res.data.data ?? "",
          size: res.data.size ?? 0,
        };
      } catch (error: unknown) {
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { code: number }).code
            : null;
        if (code === 401 || code === 403) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Google account connection is invalid. Please reconnect.",
          });
        }
        console.error("[getAttachment] error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch attachment.",
        });
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
    const userId = ctx.session.user.id;
    const gmailClient = await buildGmailClient(userId);
    if (!gmailClient) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Google account not connected. Please reconnect.",
      });
    }

    try {
      const listRes = await gmailClient.users.messages.list({
        userId: "me",
        maxResults: 100,
        q: "in:inbox",
      });
      const msgList = listRes.data.messages ?? [];

      // Warm the per-message Redis cache so the next searchEmails call is fast.
      let synced = 0;
      const CHUNK = 10;
      for (let i = 0; i < msgList.length; i += CHUNK) {
        const batch = msgList.slice(i, i + CHUNK).filter((m) => m.id);
        const results = await Promise.all(
          batch.map(async (msg) => {
            const id = msg.id!;
            const msgMetaKey = `gmail:msgmeta:v2:${userId}:${id}`;
            if (await redis.get(msgMetaKey)) return true; // already cached
            try {
              const res = await gmailClient.users.messages.get({
                userId: "me",
                id,
                format: "metadata",
              });
              const m = res.data;
              const headers = (m.payload?.headers ?? []) as {
                name?: string;
                value?: string;
              }[];
              const rawDate = m.internalDate != null ? String(m.internalDate) : null;
              const mapped: MappedMessage = {
                id: m.id ?? id,
                threadId: m.threadId ?? "",
                snippet: m.snippet ?? "",
                subject: getHeader(headers, "Subject"),
                from: getHeader(headers, "From"),
                to: getHeader(headers, "To"),
                date: rawDate,
                timestamp: messageTimestamp(rawDate ?? undefined),
              };
              if (mapped.from || mapped.subject || mapped.snippet) {
                await redis.set(msgMetaKey, mapped, { ex: 300 });
              }
              return true;
            } catch {
              return false;
            }
          }),
        );
        synced += results.filter(Boolean).length;
      }

      await bumpInboxVersion(userId);
      return { synced };
    } catch (error: unknown) {
      if (error instanceof TRPCError) throw error;
      console.error("[refreshInbox] unexpected error:", error);
      return { synced: 0 };
    }
  }),

  createDraft: protectedProcedure
    .input(
      z.object({
        to: z.string().min(1),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        attachments: z.array(outgoingAttachmentSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`gmail:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }
      assertAttachmentsWithinLimit(input.attachments);

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
      await bumpInboxVersion(ctx.session.user.id);

      return {
        id: message.id ?? "",
        threadId: message.threadId ?? "",
      };
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        to: z.string().min(1),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        attachments: z.array(outgoingAttachmentSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimitResult = await ratelimit.limit(`gmail:mutate:${ctx.session.user.id}`);
      if (!rateLimitResult.success) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." });
      }
      assertAttachmentsWithinLimit(input.attachments);

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
      await bumpInboxVersion(ctx.session.user.id);

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
      await bumpInboxVersion(ctx.session.user.id);

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
      await bumpInboxVersion(ctx.session.user.id);
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
      await bumpInboxVersion(ctx.session.user.id);
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
      await bumpInboxVersion(ctx.session.user.id);
      await redis.del(`gmail:message:${ctx.session.user.id}:${input.id}`);

      return { success: true };
    }),

  scheduleSend: protectedProcedure
    .input(
      z.object({
        to: z.string().min(1),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        sendAt: z.date(),
        threadId: z.string().optional(),
        attachments: z.array(outgoingAttachmentSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAttachmentsWithinLimit(input.attachments);

      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });
      const viralSignatureEnabled = user?.viralSignatureEnabled ?? true;
      const body = viralSignatureEnabled
        ? `${input.body}\n\n--\nSent with Gusion Mail - https://mail.gusion.in`
        : input.body;

      const raw = encodeRawEmail({
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        body,
        attachments: input.attachments,
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
