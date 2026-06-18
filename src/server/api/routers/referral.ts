import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { referrals, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { sendReferralInviteEmail } from "@/server/lib/email-service";

export const referralRouter = createTRPCRouter({
  getReferralStats: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const invites = await db.query.referrals.findMany({
      where: eq(referrals.referrerUserId, ctx.session.user.id),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });

    return {
      referralCode: user.referralCode,
      referredByCode: user.referredByCode,
      invites,
    };
  }),

  submitReferral: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const referredEmailClean = input.email.toLowerCase().trim();

      if (referredEmailClean === user.email?.toLowerCase().trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot refer yourself.",
        });
      }

      // Check if already referred
      const existing = await db.query.referrals.findFirst({
        where: and(
          eq(referrals.referrerUserId, ctx.session.user.id),
          eq(referrals.referredEmail, referredEmailClean)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already referred this email.",
        });
      }

      const [newReferral] = await db
        .insert(referrals)
        .values({
          referrerUserId: ctx.session.user.id,
          code: user.referralCode ?? "GUSION",
          referredEmail: referredEmailClean,
          status: "pending",
        })
        .returning();

      await sendReferralInviteEmail(
        referredEmailClean,
        user.name ?? user.email ?? "Someone",
        user.referralCode ?? "GUSION",
      );

      return newReferral;
    }),

  applyReferralCode: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const invitee = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });

      if (!invitee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (invitee.referredByCode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already applied a referral code.",
        });
      }

      const codeClean = input.code.toUpperCase().trim();

      if (codeClean === invitee.referralCode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot apply your own referral code.",
        });
      }

      // Find referrer user
      const referrer = await db.query.users.findFirst({
        where: eq(users.referralCode, codeClean),
      });

      if (!referrer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid referral code.",
        });
      }

      // Apply code to invitee
      await db
        .update(users)
        .set({ referredByCode: codeClean })
        .where(eq(users.id, invitee.id));

      // Check for pending referral record matching invitee email and code
      const inviteeEmailClean = invitee.email?.toLowerCase().trim() ?? "";
      const pendingReferral = await db.query.referrals.findFirst({
        where: and(
          eq(referrals.referrerUserId, referrer.id),
          eq(referrals.referredEmail, inviteeEmailClean),
          eq(referrals.status, "pending")
        ),
      });

      if (pendingReferral) {
        const now = new Date();

        // 1. Extend Referrer trial by 30 days
        const referrerTrialStart = referrer.trialStartedAt ? new Date(referrer.trialStartedAt) : new Date();
        const extendedReferrerStart = new Date(referrerTrialStart.getTime() + 30 * 24 * 60 * 60 * 1000);
        await db
          .update(users)
          .set({ trialStartedAt: extendedReferrerStart })
          .where(eq(users.id, referrer.id));

        // 2. Extend Invitee (current user) trial by 30 days
        const inviteeTrialStart = invitee.trialStartedAt ? new Date(invitee.trialStartedAt) : new Date();
        const extendedInviteeStart = new Date(inviteeTrialStart.getTime() + 30 * 24 * 60 * 60 * 1000);
        await db
          .update(users)
          .set({ trialStartedAt: extendedInviteeStart })
          .where(eq(users.id, invitee.id));

        // 3. Mark referral as rewarded
        await db
          .update(referrals)
          .set({
            status: "rewarded",
            rewardGrantedAt: now,
          })
          .where(eq(referrals.id, pendingReferral.id));
      }

      return { success: true };
    }),
});
