import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { provisionCorsairTenant } from "@/server/lib/corsair-setup";
import { env } from "@/env";
import { z } from "zod";
import { db, conn } from "@/server/db";
import { users, templates, emailMeta, schedulingLinks, bookings, contacts, referrals, accounts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createCorsairDatabase } from "corsair/db";
import { createCorsairOrm } from "corsair/orm";

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return user;
  }),

  hasGoogleOAuth: protectedProcedure.query(async ({ ctx }) => {
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.userId, ctx.session.user.id),
    });
    return { linked: !!account?.access_token };
  }),

  provisionTenant: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.session.user.corsairTenantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No Corsair tenant ID assigned to this user.",
      });
    }

    try {
      await provisionCorsairTenant(
        ctx.session.user.id,
        ctx.session.user.corsairTenantId,
        env.CORSAIR_KEK
      );
      return { success: true };
    } catch (error: unknown) {
      console.error("Failed to provision tenant:", error);
      const message = error instanceof Error ? error.message : "Failed to provision Corsair tenant.";
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message,
      });
    }
  }),

  exportData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const userTemplates = await db.query.templates.findMany({
      where: eq(templates.userId, userId),
    });

    const userEmailMeta = await db.query.emailMeta.findMany({
      where: eq(emailMeta.userId, userId),
    });

    const userLinks = await db.query.schedulingLinks.findMany({
      where: eq(schedulingLinks.userId, userId),
    });

    const linkIds = userLinks.map((l) => l.id);
    const userBookings = linkIds.length > 0
      ? await db.query.bookings.findMany({
          where: (b, { inArray }) => inArray(bookings.schedulingLinkId, linkIds),
        })
      : [];

    const userContacts = await db.query.contacts.findMany({
      where: eq(contacts.userId, userId),
    });

    const userReferrals = await db.query.referrals.findMany({
      where: eq(referrals.referrerUserId, userId),
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        gmailConnected: user.gmailConnected,
        calendarConnected: user.calendarConnected,
        trialStartedAt: user.trialStartedAt,
        createdAt: user.createdAt,
      },
      templates: userTemplates,
      emailMeta: userEmailMeta,
      schedulingLinks: userLinks,
      bookings: userBookings,
      contacts: userContacts,
      referrals: userReferrals,
    };
  }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Clean up Corsair integrations/accounts first
    if (ctx.session.user.corsairTenantId) {
      try {
        const orm = createCorsairOrm(createCorsairDatabase(conn));
        const accounts = await orm.accounts.listByTenant(ctx.session.user.corsairTenantId);
        for (const acc of accounts) {
          await orm.accounts.delete(acc.id);
        }
      } catch (err) {
        console.error("Failed to delete Corsair accounts:", err);
      }
    }

    // Delete user from DB (NextAuth cascading constraints handle deleting all sessions, accounts, and app tables)
    await db.delete(users).where(eq(users.id, userId));

    return { success: true };
  }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        viralSignatureEnabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(users)
        .set({
          viralSignatureEnabled: input.viralSignatureEnabled,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.session.user.id));
      return { success: true };
    }),
});
