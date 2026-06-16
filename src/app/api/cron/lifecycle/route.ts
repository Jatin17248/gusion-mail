import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { isNotNull, sql, eq, and } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");

export const maxDuration = 60; // 60 seconds

export async function GET(request: Request) {
  // Simple auth check for cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 13-day warning
    const thirteenDaysAgo = new Date();
    thirteenDaysAgo.setDate(thirteenDaysAgo.getDate() - 13);
    const thirteenDaysAgoStart = new Date(thirteenDaysAgo.setHours(0, 0, 0, 0));
    const thirteenDaysAgoEnd = new Date(thirteenDaysAgo.setHours(23, 59, 59, 999));

    const users13Days = await db.query.users.findMany({
      where: and(
        isNotNull(users.trialStartedAt),
        sql`${users.trialStartedAt} >= ${thirteenDaysAgoStart}`,
        sql`${users.trialStartedAt} <= ${thirteenDaysAgoEnd}`
      ),
    });

    for (const user of users13Days) {
      if (!user.email) continue;
      await resend.emails.send({
        from: "Gusion Mail <founders@gusion.in>",
        to: user.email,
        subject: "Your Gusion trial ends in 2 days",
        html: `<p>Hi ${user.name || "there"},</p><p>We hope you're enjoying Gusion! Your trial will expire in 2 days. Upgrade to a paid plan to keep your workflows running smoothly.</p>`,
      });
    }

    // 15-day expiration
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const fifteenDaysAgoStart = new Date(fifteenDaysAgo.setHours(0, 0, 0, 0));
    const fifteenDaysAgoEnd = new Date(fifteenDaysAgo.setHours(23, 59, 59, 999));

    const users15Days = await db.query.users.findMany({
      where: and(
        isNotNull(users.trialStartedAt),
        sql`${users.trialStartedAt} >= ${fifteenDaysAgoStart}`,
        sql`${users.trialStartedAt} <= ${fifteenDaysAgoEnd}`
      ),
    });

    for (const user of users15Days) {
      if (!user.email) continue;
      await resend.emails.send({
        from: "Gusion Mail <founders@gusion.in>",
        to: user.email,
        subject: "Your Gusion trial has ended",
        html: `<p>Hi ${user.name || "there"},</p><p>Your 14-day trial has ended. Your account has been paused. Please upgrade your plan to continue using Gusion Mail.</p>`,
      });
    }

    return NextResponse.json({
      success: true,
      sent13Day: users13Days.length,
      sent15Day: users15Days.length,
    });
  } catch (error) {
    console.error("Cron failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
