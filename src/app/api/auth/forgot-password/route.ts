import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

import { sendPasswordResetEmail } from "@/server/lib/email-service";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      // Don't leak whether user exists or not
      return NextResponse.json({ success: true, message: "If an account exists, a reset link will be sent to the email." });
    }

    const resetToken = crypto.randomUUID();
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db.update(users)
      .set({ passwordResetToken: resetToken, passwordResetTokenExpiry: resetTokenExpiry })
      .where(eq(users.id, user.id));

    await sendPasswordResetEmail(email.toLowerCase(), resetToken);

    return NextResponse.json({ success: true, message: "If an account exists, a reset link will be sent to the email." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ success: false, message: "An error occurred" }, { status: 500 });
  }
}
