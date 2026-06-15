import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { env } from "@/env";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const status = formData.get("status") as string;
    const firstname = formData.get("firstname") as string;
    const amount = formData.get("amount") as string;
    const txnid = formData.get("txnid") as string;
    const hash = formData.get("hash") as string;
    const key = formData.get("key") as string;
    const productinfo = formData.get("productinfo") as string;
    const email = formData.get("email") as string;
    const udf1 = formData.get("udf1") as string; // userId
    const additionalCharges = formData.get("additionalCharges") as string;
    
    const salt = env.PAYU_SALT;

    if (!salt) {
      console.error("PayU Salt not configured");
      return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/?payu_checkout=error`);
    }

    // Verify Hash
    let hashString = "";
    if (additionalCharges) {
      hashString = `${additionalCharges}|${salt}|${status}||||||||||${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    } else {
      hashString = `${salt}|${status}||||||||||${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    }

    const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

    if (calculatedHash !== hash) {
      console.error("PayU Invalid Hash");
      return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/?payu_checkout=invalid_hash`);
    }

    if (status === "success") {
      const userId = udf1;
      
      if (!userId) {
         console.error("PayU Missing userId in udf1");
         return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/?payu_checkout=error`);
      }

      // 30 days from now
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

      // Check if subscription exists
      const existingSub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      });

      if (existingSub) {
        await db.update(subscriptions)
          .set({
            plan: "pro",
            status: "active",
            currentPeriodEnd,
            payuSubscriptionId: txnid, // Using txnid as reference for one-time payment
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await db.insert(subscriptions).values({
          userId,
          plan: "pro",
          status: "active",
          currentPeriodEnd,
          payuSubscriptionId: txnid,
        });
      }

      return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/?payu_checkout=success`);
    } else {
      return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/?payu_checkout=cancel`);
    }
  } catch (error) {
    console.error("Error processing PayU webhook:", error);
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/?payu_checkout=error`);
  }
}
