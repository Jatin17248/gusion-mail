import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { eq } from "drizzle-orm";


const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

interface SubscriptionWithPeriod extends Stripe.Subscription {
  current_period_end: number;
}

export async function POST(req: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown verification error";
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (userId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          // @ts-expect-error - stripe columns were removed for PayU migration, keeping for reference
          await db.insert(subscriptions).values({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            plan: "pro",
            status: subscription.status,
            currentPeriodEnd: new Date((subscription as unknown as SubscriptionWithPeriod).current_period_end * 1000),
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const status = subscription.status;

        const existing = await db.query.subscriptions.findFirst({
          // @ts-expect-error - stripe columns removed
          where: eq(subscriptions.stripeSubscriptionId, subscriptionId),
        });

        if (existing) {
          await db
            .update(subscriptions)
            .set({
              status,
              currentPeriodEnd: new Date((subscription as unknown as SubscriptionWithPeriod).current_period_end * 1000),
              updatedAt: new Date(),
            })
            // @ts-expect-error - stripe columns removed
            .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        }
        break;
      }
      case "customer.subscription.deleted": {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        await db
          .update(subscriptions)
          .set({
            status: "canceled",
            updatedAt: new Date(),
          })
          // @ts-expect-error - stripe columns removed
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        break;
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    console.error("Webhook processing failed:", message);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
