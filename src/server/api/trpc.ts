/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { users, organizations, orgMembers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/env";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    const val = parts.slice(1).join("=").trim();
    if (name) cookies[name] = val;
  });
  return cookies;
}

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  let org: { id: string; name: string; role: string } | null = null;
  let isImpersonating = false;
  let adminUserId: string | null = null;

  if (session?.user?.id) {
    let userId = session.user.id;
    
    // Check if user is staff to enable impersonation check
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    let activeUser = dbUser;

    if (dbUser) {
      const adminEmails = env.PRODUCT_ADMIN_EMAILS
        ? env.PRODUCT_ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
        : [];
      const isStaff =
        dbUser.isStaff === true ||
        (dbUser.email && adminEmails.includes(dbUser.email.toLowerCase()));

      if (isStaff) {
        const cookies = parseCookies(opts.headers.get("cookie"));
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const impId = cookies["gusion_impersonate_id"];
        if (impId && impId !== userId) {
          const targetUser = await db.query.users.findFirst({
            where: eq(users.id, impId),
          });
          if (targetUser) {
            adminUserId = userId;
            userId = impId;
            isImpersonating = true;
            activeUser = targetUser;
            
            // Override session.user details for tRPC context
            session.user = {
              ...session.user,
              id: targetUser.id,
              email: targetUser.email,
              name: targetUser.name,
              corsairTenantId: targetUser.corsairTenantId,
              gmailConnected: targetUser.gmailConnected ?? undefined,
              calendarConnected: targetUser.calendarConnected ?? undefined,
              isStaff: false, // Inside context, treat as non-staff to prevent privilege escalation
              suspendedAt: targetUser.suspendedAt ? targetUser.suspendedAt.toISOString() : null,
            };
          }
        }
      }
    }

    // Now proceed with normal activeOrgId / org member retrieval for the active user ID
    if (activeUser) {
      let activeOrgId = activeUser.activeOrgId;
      let memberRecord = null;

      if (activeOrgId) {
        memberRecord = await db.query.orgMembers.findFirst({
          where: and(
            eq(orgMembers.userId, userId),
            eq(orgMembers.orgId, activeOrgId)
          ),
        });
      }

      if (!memberRecord) {
        // Fallback to first org they are member of
        memberRecord = await db.query.orgMembers.findFirst({
          where: eq(orgMembers.userId, userId),
        });
        if (memberRecord) {
          activeOrgId = memberRecord.orgId;
          // Save activeOrgId
          await db.update(users).set({ activeOrgId }).where(eq(users.id, userId));
        }
      }

      if (!memberRecord) {
        // No org exists for user, create a default one
        const orgId = crypto.randomUUID();
        const orgName = `${activeUser.name ?? "Personal"}'s Team`;
        await db.insert(organizations).values({
          id: orgId,
          name: orgName,
        });
        await db.insert(orgMembers).values({
          orgId,
          userId,
          role: "owner",
        });
        await db.update(users).set({ activeOrgId: orgId }).where(eq(users.id, userId));

        activeOrgId = orgId;
        memberRecord = { orgId, userId, role: "owner" };
      }

      if (activeOrgId && memberRecord) {
        const dbOrg = await db.query.organizations.findFirst({
          where: eq(organizations.id, activeOrgId),
        });
        if (dbOrg) {
          org = {
            id: dbOrg.id,
            name: dbOrg.name,
            role: memberRecord.role,
          };
        }
      }
    }
  }

  return {
    db,
    session,
    org,
    isImpersonating,
    adminUserId,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

import { logger } from "@/server/lib/logger";

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  logger.info(`[TRPC] ${path} executed`, { durationMs: end - start });

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to only be accessible to logged in users, use this procedure. It
 * verifies the session is valid and guarantees `ctx.session.user` is not null.
 */
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure.use(timingMiddleware).use(isAuthed);

export const orgProcedure = protectedProcedure.use((opts) => {
  if (!opts.ctx.org) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Organization context required." });
  }
  return opts.next({
    ctx: {
      org: opts.ctx.org,
    },
  });
});

export const requireOrgRole = (roles: ("owner" | "admin" | "member")[]) =>
  t.middleware(({ next, ctx }) => {
    if (!ctx.session?.user || !ctx.org) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not a member of an organization." });
    }
    const role = ctx.org.role;
    if (!roles.some((r) => r === role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient organization permissions." });
    }
    return next({
      ctx: {
        org: ctx.org,
      },
    });
  });

const isProductAdmin = t.middleware(async ({ next, ctx }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const userId = ctx.adminUserId ?? ctx.session.user.id;
  const dbUser = await ctx.db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!dbUser) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const adminEmails = env.PRODUCT_ADMIN_EMAILS
    ? env.PRODUCT_ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
    : [];
  const isStaff =
    dbUser.isStaff === true ||
    (dbUser.email && adminEmails.includes(dbUser.email.toLowerCase()));

  if (!isStaff) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Requires product admin privileges." });
  }

  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: { ...ctx.session.user, isStaff: true },
      },
    },
  });
});

export const productAdminProcedure = protectedProcedure.use(isProductAdmin);
