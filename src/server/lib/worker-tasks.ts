import { db } from "@/server/db";
import {
  emailMeta,
  sendQueue,
  followUps,
  users,
  bulkCampaigns,
  bulkRecipients,
  suppressionList,
  systemConfigs,
} from "@/server/db/schema";
import { and, eq, lte, sql, isNotNull } from "drizzle-orm";
import { getTenant } from "@/server/lib/tenant";
import { publishUserEvent } from "@/server/lib/realtime";
import { encodeRawEmail } from "@/server/lib/email";
import { errorMessage } from "@/server/lib/http";
import { Resend } from "resend";

function personalize(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), val);
  }
  return result;
}

export async function processJobs() {
  const now = new Date();
  const results = {
    snoozedReleased: 0,
    emailsSent: 0,
    emailsFailed: 0,
    followUpsReminded: 0,
    followUpsDismissed: 0,
    campaignsSent: 0,
    campaignsFailed: 0,
    campaignsCompleted: 0,
  };

  // 1. Process Snooze Releases
  const snoozedMeta = await db.query.emailMeta.findMany({
    where: and(
      eq(emailMeta.isSnoozed, true),
      lte(emailMeta.snoozeUntil, now)
    ),
  });

  for (const meta of snoozedMeta) {
    await db
      .update(emailMeta)
      .set({
        isSnoozed: false,
        snoozeUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(emailMeta.id, meta.id));

    results.snoozedReleased++;

    // Trigger realtime refresh
    await publishUserEvent(meta.userId, {
      type: "inbox_update",
      message: "Snoozed email released to inbox",
    });
  }

  // 2. Process Send Later (Queue)
  const pendingSends = await db.query.sendQueue.findMany({
    where: and(
      eq(sendQueue.status, "pending"),
      lte(sendQueue.sendAt, now)
    ),
  });

  for (const item of pendingSends) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, item.userId),
    });

    if (!user?.corsairTenantId) {
      await db
        .update(sendQueue)
        .set({ status: "failed" })
        .where(eq(sendQueue.id, item.id));
      results.emailsFailed++;
      continue;
    }

    try {
      const tenant = getTenant(user.corsairTenantId);
      await tenant.gmail.api.messages.send({
        raw: item.rawBase64Url,
        threadId: item.threadId ?? undefined,
      });

      await db
        .update(sendQueue)
        .set({ status: "sent" })
        .where(eq(sendQueue.id, item.id));

      results.emailsSent++;

      await publishUserEvent(item.userId, {
        type: "inbox_update",
        message: "Scheduled email sent successfully",
      });
    } catch (err) {
      console.error(`Failed to send scheduled email ${item.id}:`, err);
      await db
        .update(sendQueue)
        .set({ status: "failed" })
        .where(eq(sendQueue.id, item.id));
      results.emailsFailed++;
    }
  }

  // 3. Process Follow-ups
  const pendingFollowUps = await db.query.followUps.findMany({
    where: and(
      eq(followUps.status, "pending"),
      lte(followUps.remindAt, now)
    ),
  });

  for (const followUp of pendingFollowUps) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, followUp.userId),
    });

    if (!user?.corsairTenantId) {
      await db
        .update(followUps)
        .set({ status: "dismissed" })
        .where(eq(followUps.id, followUp.id));
      results.followUpsDismissed++;
      continue;
    }

    try {
      const tenant = getTenant(user.corsairTenantId);
      // Fetch thread messages from db
      const threadMessages = await tenant.gmail.db.messages.search({
        data: {
          threadId: followUp.threadId,
        },
      });

      // Sort chronologically by creation time
      const sorted = [...threadMessages].sort((a, b) => {
        const timeA = a.data.createdAt ? new Date(a.data.createdAt).getTime() : 0;
        const timeB = b.data.createdAt ? new Date(b.data.createdAt).getTime() : 0;
        return timeA - timeB;
      });

      // Find the original message index
      const origIndex = sorted.findIndex((m) => m.entity_id === followUp.sentMessageId);

      // Check if there are any subsequent messages from someone else (different email than host)
      const userEmail = user.email?.toLowerCase() ?? "";
      const hasReply = sorted.slice(origIndex + 1).some((m) => {
        const from = m.data.from?.toLowerCase() ?? "";
        // If the message sender is different than user's email, it is a reply
        return !from.includes(userEmail);
      });

      if (hasReply) {
        // A reply was received, follow-up no longer needed
        await db
          .update(followUps)
          .set({ status: "dismissed" })
          .where(eq(followUps.id, followUp.id));
        results.followUpsDismissed++;
      } else {
        // No reply received, trigger notification nudge
        await db
          .update(followUps)
          .set({ status: "reminded" })
          .where(eq(followUps.id, followUp.id));

        results.followUpsReminded++;

        await publishUserEvent(followUp.userId, {
          type: "inbox_update",
          message: `Follow-up Reminder: No response to thread. Reason: ${followUp.reason ?? "Nudge"}`,
        });
      }
    } catch (err) {
      console.error(`Failed to process follow-up ${followUp.id}:`, err);
      // Fail-safe: dismiss follow-up if thread fetch fails repeatedly
      await db
        .update(followUps)
        .set({ status: "dismissed" })
        .where(eq(followUps.id, followUp.id));
      results.followUpsDismissed++;
    }
  }

  // 4. Process Running Bulk Campaigns
  const disableBulkSendConfig = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, "disableBulkSend"),
  });
  const isBulkSendDisabled = disableBulkSendConfig && JSON.parse(disableBulkSendConfig.value) === true;

  if (!isBulkSendDisabled) {
    const runningCampaigns = await db.query.bulkCampaigns.findMany({
      where: eq(bulkCampaigns.status, "running"),
    });

    for (const campaign of runningCampaigns) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, campaign.userId),
      });

      if (!user?.corsairTenantId) {
        await db
          .update(bulkCampaigns)
          .set({ status: "failed" })
          .where(eq(bulkCampaigns.id, campaign.id));
        continue;
      }

      const pendingRecipients = await db.query.bulkRecipients.findMany({
        where: and(
          eq(bulkRecipients.campaignId, campaign.id),
          eq(bulkRecipients.status, "pending")
        ),
        limit: 5,
      });

      if (pendingRecipients.length === 0) {
        await db
          .update(bulkCampaigns)
          .set({ status: "completed" })
          .where(eq(bulkCampaigns.id, campaign.id));

        results.campaignsCompleted++;

        await publishUserEvent(campaign.userId, {
          type: "inbox_update",
          message: `Bulk Campaign "${campaign.name}" completed successfully.`,
        });
        continue;
      }

      const tenant = getTenant(user.corsairTenantId);

      for (const recipient of pendingRecipients) {
        const suppressed = await db.query.suppressionList.findFirst({
          where: and(
            eq(suppressionList.orgId, campaign.orgId),
            eq(suppressionList.email, recipient.email.toLowerCase().trim())
          ),
        });

        if (suppressed) {
          await db
            .update(bulkRecipients)
            .set({ status: "unsubscribed" })
            .where(eq(bulkRecipients.id, recipient.id));
          continue;
        }

        let vars: Record<string, string> = {};
        try {
          const parsed: unknown = JSON.parse(recipient.variables);
          if (parsed && typeof parsed === "object") {
            vars = parsed as Record<string, string>;
          }
        } catch {
          vars = {};
        }

        const personalizedSubject = personalize(campaign.subject, vars);
        let personalizedBody = personalize(campaign.body, vars);
        const unsubLink = `https://mail.gusion.in/unsubscribe?orgId=${campaign.orgId}&email=${encodeURIComponent(recipient.email)}`;
        personalizedBody += `\n\n--\nTo unsubscribe from these emails, click here: ${unsubLink}`;

        try {
          const raw = encodeRawEmail({
            to: recipient.email,
            subject: personalizedSubject,
            body: personalizedBody,
          });

          await tenant.gmail.api.messages.send({ raw });

          await db
            .update(bulkRecipients)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(bulkRecipients.id, recipient.id));

          await db
            .update(bulkCampaigns)
            .set({ sentCount: sql`bulk_campaigns.sent_count + 1` })
            .where(eq(bulkCampaigns.id, campaign.id));

          results.campaignsSent++;
        } catch (err) {
          console.error(`Failed to send campaign email to ${recipient.email}:`, err);
          await db
            .update(bulkRecipients)
            .set({ status: "failed", error: errorMessage(err, "Failed send") })
            .where(eq(bulkRecipients.id, recipient.id));

          await db
            .update(bulkCampaigns)
            .set({ failedCount: sql`bulk_campaigns.failed_count + 1` })
            .where(eq(bulkCampaigns.id, campaign.id));

          results.campaignsFailed++;
        }
      }
    }
  } else {
    console.log("[Worker] Bulk campaigns processing skipped (globally disabled).");
  }

  return results;
}

export async function processLifecycle() {
  const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");

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

  return {
    sent13Day: users13Days.length,
    sent15Day: users15Days.length,
  };
}
