import { z } from "zod";
import { createTRPCRouter, productAdminProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  users,
  organizations,
  orgMembers,
  subscriptions,
  sendQueue,
  webhookDeliveryLogs,
  automationRuns,
  connectedAccounts,
  apiKeys,
  outboundWebhooks,
  systemConfigs,
  auditLogs
} from "@/server/db/schema";
import { eq, and, sql, desc, or, ilike } from "drizzle-orm";

async function logAdminAction(db: any, operatorId: string, action: string, metadata: any) {
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: operatorId,
      action,
      metadata: JSON.stringify(metadata),
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to log admin action:", err);
  }
}

export const adminRouter = createTRPCRouter({
  getMetrics: productAdminProcedure.query(async ({ ctx }) => {
    // 1. Core Platform Counts
    const [userCount] = await ctx.db.select({ value: sql<number>`count(*)::int` }).from(users);
    const [orgCount] = await ctx.db.select({ value: sql<number>`count(*)::int` }).from(organizations);

    // 2. Active Trial Count
    const now = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [trialCount] = await ctx.db
      .select({ value: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`${users.trialStartedAt} >= ${fourteenDaysAgo}`);

    // 3. Subscription Breakdown
    const subs = await ctx.db.query.subscriptions.findMany();
    const plans: Record<string, number> = { free: 0, pro: 0, team: 0 };
    subs.forEach((s) => {
      const planName = s.plan || "free";
      plans[planName] = (plans[planName] || 0) + 1;
    });

    // 4. Job queue metrics
    const [pendingJobs] = await ctx.db
      .select({ value: sql<number>`count(*)::int` })
      .from(sendQueue)
      .where(eq(sendQueue.status, "pending"));

    const [failedJobs] = await ctx.db
      .select({ value: sql<number>`count(*)::int` })
      .from(sendQueue)
      .where(eq(sendQueue.status, "failed"));

    const [failedWebhooks] = await ctx.db
      .select({ value: sql<number>`count(*)::int` })
      .from(webhookDeliveryLogs)
      .where(eq(webhookDeliveryLogs.success, false));

    const [failedAutomations] = await ctx.db
      .select({ value: sql<number>`count(*)::int` })
      .from(automationRuns)
      .where(eq(automationRuns.status, "failed"));

    return {
      users: userCount?.value ?? 0,
      organizations: orgCount?.value ?? 0,
      trials: trialCount?.value ?? 0,
      subscriptions: plans,
      queue: {
        pending: pendingJobs?.value ?? 0,
        failed: failedJobs?.value ?? 0,
        failedWebhooks: failedWebhooks?.value ?? 0,
        failedAutomations: failedAutomations?.value ?? 0,
      },
    };
  }),

  listUsers: productAdminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      let whereClause = undefined;
      if (input.search) {
        whereClause = or(
          ilike(users.email, `%${input.search}%`),
          ilike(users.name, `%${input.search}%`),
          eq(users.id, input.search)
        );
      }

      const list = await ctx.db.query.users.findMany({
        where: whereClause,
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(users.createdAt)],
      });

      const [total] = await ctx.db
        .select({ value: sql<number>`count(*)::int` })
        .from(users)
        .where(whereClause);

      return {
        users: list,
        total: total?.value ?? 0,
      };
    }),

  listOrgs: productAdminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      let whereClause = undefined;
      if (input.search) {
        whereClause = or(
          ilike(organizations.name, `%${input.search}%`),
          eq(organizations.id, input.search)
        );
      }

      const list = await ctx.db.query.organizations.findMany({
        where: whereClause,
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(organizations.createdAt)],
      });

      const [total] = await ctx.db
        .select({ value: sql<number>`count(*)::int` })
        .from(organizations)
        .where(whereClause);

      return {
        organizations: list,
        total: total?.value ?? 0,
      };
    }),

  getUserDetails: productAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      const accountsList = await ctx.db.query.connectedAccounts.findMany({
        where: eq(connectedAccounts.userId, input.userId),
      });

      const sub = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, input.userId),
      });

      const memberships = await ctx.db.query.orgMembers.findMany({
        where: eq(orgMembers.userId, input.userId),
      });

      const memberOrgs = await Promise.all(
        memberships.map(async (m) => {
          const org = await ctx.db.query.organizations.findFirst({
            where: eq(organizations.id, m.orgId),
          });
          return {
            id: m.orgId,
            role: m.role,
            name: org?.name ?? "Unknown",
          };
        })
      );

      return {
        user,
        connectedAccounts: accountsList,
        subscription: sub ?? null,
        organizations: memberOrgs,
      };
    }),

  getOrgDetails: productAdminProcedure
    .input(z.object({ orgId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.orgId),
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });

      const members = await ctx.db.query.orgMembers.findMany({
        where: eq(orgMembers.orgId, input.orgId),
      });

      const memberUsers = await Promise.all(
        members.map(async (m) => {
          const user = await ctx.db.query.users.findFirst({
            where: eq(users.id, m.userId),
          });
          return {
            id: m.userId,
            role: m.role,
            name: user?.name ?? "Unknown",
            email: user?.email ?? "Unknown",
          };
        })
      );

      const keys = await ctx.db.query.apiKeys.findMany({
        where: eq(apiKeys.orgId, input.orgId),
      });

      const webhooks = await ctx.db.query.outboundWebhooks.findMany({
        where: eq(outboundWebhooks.orgId, input.orgId),
      });

      return {
        org,
        members: memberUsers,
        apiKeys: keys,
        webhooks,
      };
    }),

  toggleUserStaff: productAdminProcedure
    .input(z.object({ userId: z.string().min(1), isStaff: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own staff privileges.",
        });
      }

      await ctx.db
        .update(users)
        .set({ isStaff: input.isStaff, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

      await logAdminAction(ctx.db, ctx.session.user.id, "toggle_user_staff", {
        targetUserId: input.userId,
        isStaff: input.isStaff,
      });

      return { success: true };
    }),

  toggleUserSuspension: productAdminProcedure
    .input(z.object({ userId: z.string().min(1), suspend: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot suspend your own account.",
        });
      }

      const suspendedAt = input.suspend ? new Date() : null;

      await ctx.db
        .update(users)
        .set({ suspendedAt, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

      await logAdminAction(ctx.db, ctx.session.user.id, "toggle_user_suspension", {
        targetUserId: input.userId,
        suspended: input.suspend,
      });

      return { success: true };
    }),

  resetUserTrial: productAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ trialStartedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, input.userId));

      await logAdminAction(ctx.db, ctx.session.user.id, "reset_user_trial", {
        targetUserId: input.userId,
      });

      return { success: true };
    }),

  disconnectGmail: productAdminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({
          gmailConnected: false,
          calendarConnected: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId));

      await logAdminAction(ctx.db, ctx.session.user.id, "disconnect_gmail", {
        targetUserId: input.userId,
      });

      return { success: true };
    }),

  updateUserSubscription: productAdminProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        plan: z.enum(["free", "pro", "team"]),
        status: z.enum(["active", "trialing", "past_due", "canceled"]),
        currentPeriodEnd: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, input.userId),
      });

      const periodEnd = input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null;

      if (existing) {
        await ctx.db
          .update(subscriptions)
          .set({
            plan: input.plan,
            status: input.status,
            currentPeriodEnd: periodEnd,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.userId, input.userId));
      } else {
        await ctx.db.insert(subscriptions).values({
          id: crypto.randomUUID(),
          userId: input.userId,
          plan: input.plan,
          status: input.status,
          currentPeriodEnd: periodEnd,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await logAdminAction(ctx.db, ctx.session.user.id, "update_subscription", {
        targetUserId: input.userId,
        plan: input.plan,
        status: input.status,
        currentPeriodEnd: periodEnd,
      });

      return { success: true };
    }),

  getSystemConfigs: productAdminProcedure.query(async ({ ctx }) => {
    const list = await ctx.db.query.systemConfigs.findMany();
    const configs: Record<string, any> = {};
    list.forEach((c) => {
      try {
        configs[c.key] = JSON.parse(c.value);
      } catch {
        configs[c.key] = c.value;
      }
    });
    return configs;
  }),

  updateSystemConfig: productAdminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const strVal = JSON.stringify(input.value);

      const existing = await ctx.db.query.systemConfigs.findFirst({
        where: eq(systemConfigs.key, input.key),
      });

      if (existing) {
        await ctx.db
          .update(systemConfigs)
          .set({
            value: strVal,
            updatedAt: new Date(),
            updatedByUserId: ctx.session.user.id,
          })
          .where(eq(systemConfigs.key, input.key));
      } else {
        await ctx.db.insert(systemConfigs).values({
          key: input.key,
          value: strVal,
          updatedAt: new Date(),
          updatedByUserId: ctx.session.user.id,
        });
      }

      await logAdminAction(ctx.db, ctx.session.user.id, "update_system_config", {
        key: input.key,
        value: input.value,
      });

      return { success: true };
    }),

  getAuditLogs: productAdminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const list = await ctx.db.query.auditLogs.findMany({
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(auditLogs.createdAt)],
      });

      const logsWithUser = await Promise.all(
        list.map(async (log) => {
          let userEmail = "Unknown";
          if (log.userId) {
            const u = await ctx.db.query.users.findFirst({
              where: eq(users.id, log.userId),
            });
            userEmail = u?.email ?? "Unknown";
          }
          return {
            ...log,
            userEmail,
          };
        })
      );

      const [total] = await ctx.db
        .select({ value: sql<number>`count(*)::int` })
        .from(auditLogs);

      return {
        logs: logsWithUser,
        total: total?.value ?? 0,
      };
    }),
});
