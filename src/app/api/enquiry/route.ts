import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");
const FROM_EMAIL = process.env.FROM_EMAIL || "Gusion Mail <no-reply@gusion.in>";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, mobile, type = "callback_request" } = body;

    // Validation
    if (!name || !email || !mobile) {
      return NextResponse.json(
        { message: "Name, email, and mobile number are required." },
        { status: 400 }
      );
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return NextResponse.json(
        { message: "Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9." },
        { status: 400 }
      );
    }

    // 1. Insert into Drizzle Database under auditLogs
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    await db.insert(auditLogs).values({
      action: "LEAD_SUBMISSION",
      metadata: JSON.stringify({ name, email, mobile, type }),
      ip,
    });

    // 2. Send email notification to user & CC sales/support
    try {
      if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_dummy") {
        // Send email to customer
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          cc: "sales@gusion.in",
          subject: "Thank you for requesting a workspace demo",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0067ff;">Gusion Mail Workspace Demo</h2>
              <p>Hi ${name},</p>
              <p>Thank you for requesting a workspace demo on Gusion Mail. One of our product specialists will reach out to you shortly at <strong>${mobile}</strong>.</p>
              <p>In the meantime, you can sign up for a 14-day free trial on our platform to explore keyboard-first AI email and integrated calendar workflows.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #718096;">If you did not request this, please ignore this email.</p>
            </div>
          `,
        });
      } else {
        console.log("Mocking email send (RESEND_API_KEY is dummy)");
      }
    } catch (emailErr) {
      console.error("Failed to send lead email notification:", emailErr);
    }

    return NextResponse.json(
      { success: true, message: "Workspace demo request submitted successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Enquiry Submission Error:", error);
    return NextResponse.json(
      { message: "An error occurred during submission" },
      { status: 500 }
    );
  }
}
