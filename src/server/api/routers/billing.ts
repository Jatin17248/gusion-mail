import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { subscriptions, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { trackEvent } from "@/lib/analytics";
import crypto from "crypto";

export const billingRouter = createTRPCRouter({
  createCheckoutSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      trackEvent(ctx.session.user.id, "payu_checkout_initiated");
      
      const key = env.PAYU_MERCHANT_KEY;
      const salt = env.PAYU_SALT;
      
      if (!key || !salt) {
        // Mock session in development when PayU is not configured
        return {
          mock: true,
          url: `${env.NEXT_PUBLIC_APP_URL}?mock_payu_checkout=success`,
        };
      }

      const txnid = `txn_${crypto.randomBytes(8).toString('hex')}`;
      const amount = "20.00"; // Assuming $20/mo or equivalent in local currency
      const productinfo = "Gusion Mail Pro Subscription";
      const firstname = ctx.session.user.name?.split(' ')[0] ?? "User";
      const email = ctx.session.user.email ?? "";
      
      const surl = `${env.NEXT_PUBLIC_APP_URL}/api/payu/webhook`;
      const curl = `${env.NEXT_PUBLIC_APP_URL}/?payu_checkout=cancel`;

      // Hash sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
      // Using udf1 to store userId for webhook processing
      const udf1 = ctx.session.user.id;
      const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}||||||||||${salt}`;
      const hash = crypto.createHash('sha512').update(hashString).digest('hex');

      const payuBaseUrl = env.PAYU_BASE_URL ?? "https://secure.payu.in/_payment";

      return {
        mock: false,
        payuUrl: payuBaseUrl,
        params: {
          key,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          phone: "", // Optional, but required by some PayU setups, client can fill
          surl,
          curl,
          furl: curl, // Failure URL
          hash,
          udf1,
        }
      };
    }),

  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    trackEvent(ctx.session.user.id, "payu_portal_opened");
    // PayU does not have a drop-in customer portal like Stripe.
    // For now, we return a mock URL. You would integrate PayU's subscription management API here.
    return { url: `${env.NEXT_PUBLIC_APP_URL}?mock_payu_portal=active` };
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
