import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { subscriptions, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { env } from "@/env";

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export const billingRouter = createTRPCRouter({
  createCheckoutSession: protectedProcedure
    .input(z.object({ priceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!stripe) {
        // Mock session in development when Stripe is not configured
        return {
          url: `${env.NEXT_PUBLIC_APP_URL}?mock_stripe_checkout=success`,
        };
      }

      // Check if user already has a customer ID
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      let customerId = user.referredByCode ?? ""; // Reuse this column or check subscriptions
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, ctx.session.user.id),
      });
      if (sub?.stripeCustomerId) {
        customerId = sub.stripeCustomerId;
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: ctx.session.user.email ?? undefined,
          name: ctx.session.user.name ?? undefined,
          metadata: { userId: ctx.session.user.id },
        });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: input.priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${env.NEXT_PUBLIC_APP_URL}/?stripe_checkout=success`,
        cancel_url: `${env.NEXT_PUBLIC_APP_URL}/?stripe_checkout=cancel`,
        metadata: { userId: ctx.session.user.id },
      });

      return { url: session.url };
    }),

  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.session.user.id),
    });

    if (!sub?.stripeCustomerId || !stripe) {
      return {
        url: `${env.NEXT_PUBLIC_APP_URL}?mock_stripe_portal=active`,
      };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: env.NEXT_PUBLIC_APP_URL,
    });

    return { url: session.url };
  }),

  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, ctx.session.user.id),
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });

    let trialDaysRemaining = 14;
    if (user?.trialStartedAt) {
      const elapsed = Date.now() - new Date(user.trialStartedAt).getTime();
      trialDaysRemaining = Math.max(0, 14 - Math.floor(elapsed / (1000 * 60 * 60 * 24)));
    }

    return {
      plan: sub?.plan ?? "free",
      status: sub?.status ?? "inactive",
      trialDaysRemaining,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    };
  }),
});
