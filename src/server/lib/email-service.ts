import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM_EMAIL = process.env.FROM_EMAIL || "Gusion Mail <no-reply@gusion.in>";

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${APP_URL}/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your Gusion password",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password for your Gusion account. Click the button below to set a new password:</p>
          <a href="${resetLink}" style="display: inline-block; background-color: #e61f2a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Reset Password</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
}

export async function sendReferralInviteEmail(
  toEmail: string,
  referrerName: string,
  referralCode: string,
) {
  const signupLink = `${APP_URL}/register?ref=${referralCode}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `${referrerName} invited you to try Gusion Mail`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited!</h2>
          <p><strong>${referrerName}</strong> thinks you'd love Gusion — the AI email assistant that replies, summarises, and schedules for you.</p>
          <p>Sign up using the link below and both of you get <strong>30 extra days</strong> on the free trial.</p>
          <a href="${signupLink}" style="display: inline-block; background-color: #e61f2a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Claim your free trial</a>
          <p style="color: #888; font-size: 12px;">Sent with Gusion Mail — ${APP_URL}</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send referral invite email:", error);
    throw new Error("Failed to send referral invite email");
  }
}

export async function sendTeamInvitationEmail(email: string, token: string, orgName: string, invitedBy: string) {
  const inviteLink = `${APP_URL}/accept-invite?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `You've been invited to join ${orgName} on Gusion`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Team Invitation</h2>
          <p><strong>${invitedBy}</strong> has invited you to join their team <strong>${orgName}</strong> on Gusion.</p>
          <p>Click the button below to accept the invitation and set up your account:</p>
          <a href="${inviteLink}" style="display: inline-block; background-color: #0067ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Accept Invitation</a>
          <p>This invitation will expire in 7 days.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send team invitation email:", error);
    throw new Error("Failed to send team invitation email");
  }
}
