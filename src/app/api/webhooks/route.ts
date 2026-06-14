import { processWebhook } from "corsair";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { db } from "@/server/db";
import {
  users,
  emailMeta,
  webhookEvents,
  contacts,
  corsairAccounts,
  tickets,
  rules,
  automationRuns,
  outboundWebhooks,
  webhookDeliveryLogs,
} from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { env } from "@/env";
import { publishUserEvent } from "@/server/lib/realtime";
import { getTenant } from "@/server/lib/tenant";
import { encodeRawEmail } from "@/server/lib/email";

function matchConditions(
  msg: { subject: string; from: string; body: string; priority: string },
  conditions: any[]
): boolean {
  if (!conditions || conditions.length === 0) return false;
  for (const cond of conditions) {
    const fieldVal = (msg[cond.field as keyof typeof msg] || "").toLowerCase();
    const targetVal = (cond.value || "").toLowerCase();

    switch (cond.operator) {
      case "equals":
        if (fieldVal !== targetVal) return false;
        break;
      case "contains":
        if (!fieldVal.includes(targetVal)) return false;
        break;
      case "starts_with":
        if (!fieldVal.startsWith(targetVal)) return false;
        break;
      case "ends_with":
        if (!fieldVal.endsWith(targetVal)) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

async function fireOutboundWebhook(
  orgId: string,
  event: string,
  payload: any
) {
  const subscriptions = await db.query.outboundWebhooks.findMany({
    where: and(
      eq(outboundWebhooks.orgId, orgId),
      eq(outboundWebhooks.isActive, true)
    ),
  });

  const crypto = await import("crypto");

  for (const sub of subscriptions) {
    let subEvents: string[] = [];
    try {
      subEvents = JSON.parse(sub.events);
    } catch (e) {
      subEvents = [];
    }

    if (!subEvents.includes(event)) continue;

    const payloadStr = JSON.stringify(payload);
    const hmac = crypto.createHmac("sha256", sub.secret);
    const signature = hmac.update(payloadStr).digest("hex");

    try {
      const response = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gusion-Signature": signature,
          "X-Gusion-Event": event,
        },
        body: payloadStr,
      });

      const responseBody = await response.text();
      await db.insert(webhookDeliveryLogs).values({
        orgId,
        webhookId: sub.id,
        event,
        payload: payloadStr,
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 1000),
        success: response.ok,
      });
    } catch (err: any) {
      await db.insert(webhookDeliveryLogs).values({
        orgId,
        webhookId: sub.id,
        event,
        payload: payloadStr,
        responseStatus: 0,
        responseBody: err.message || "Failed to fetch",
        success: false,
      });
    }
  }
}


function parseSender(fromStr?: string): { name: string | null; email: string } {
  if (!fromStr) return { name: null, email: "" };
  const emailMatch = /<([^>]+)>/.exec(fromStr);
  if (emailMatch?.[1]) {
    const email = emailMatch[1].trim().toLowerCase();
    const name = fromStr.replace(/<[^>]+>/, "").replace(/["']/g, "").trim();
    return { name: name !== "" ? name : null, email };
  }
  const email = fromStr.trim().toLowerCase();
  return { name: null, email };
}

interface CorsairMessage {
  entity_id: string;
  data: {
    threadId?: string;
    snippet?: string;
    subject?: string;
    from?: string;
    to?: string;
    body?: string;
    internalDate?: string;
    createdAt?: Date | null;
  };
}

export async function POST(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const contentType = request.headers.get("content-type");
  let body: unknown;

  if (contentType?.includes("application/json")) {
    body = await request.json() as unknown;
  } else {
    const text = await request.text();
    body = text.trim() ? text : {};
  }

  // Resolve tenant from the payload's account. Never fall back to a shared
  // default tenant — that would let a forged request touch another user's data.
  const url = new URL(request.url);
  let tenantId = url.searchParams.get("tenantId") ?? "";
  let accountId = "";

  if (body && typeof body === "object") {
    const b = body as {
      accountId?: string;
      account_id?: string;
      payload?: { accountId?: string; account_id?: string };
    };
    accountId =
      b.accountId ?? b.account_id ?? b.payload?.accountId ?? b.payload?.account_id ?? "";
  }

  if (accountId) {
    const account = await db.query.corsairAccounts.findFirst({
      where: eq(corsairAccounts.id, accountId),
    });
    if (account) {
      tenantId = account.tenantId;
    }
  }

  if (!tenantId) {
    return NextResponse.json({ error: "Unresolved tenant" }, { status: 400 });
  }

  // Webhook signature verification: when a signature is present and a secret is
  // configured, it must match.
  const signature =
    request.headers.get("x-corsair-signature") ?? request.headers.get("x-signature");
  if (signature && process.env.CORSAIR_WEBHOOK_SECRET) {
    const rawBody = typeof body === "string" ? body : JSON.stringify(body);
    const crypto = await import("crypto");
    const digest = crypto
      .createHmac("sha256", process.env.CORSAIR_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    if (signature !== digest) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // 1. Resolve User and check database
  const user = await db.query.users.findFirst({
    where: eq(users.corsairTenantId, tenantId),
  });

  if (!user) {
    console.error(`Webhook received for unknown tenant: ${tenantId}`);
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }

  // 2. Idempotency check using webhook event messageId or header signature hash
  const bodyMessage = body as { message?: { messageId?: string } } | null | undefined;
  const webhookId: string =
    bodyMessage?.message?.messageId ??
    request.headers.get("x-corsair-event-id") ??
    request.headers.get("webhook-id") ??
    crypto.randomUUID();

  const existingWebhook = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.id, webhookId),
  });

  if (existingWebhook) {
    return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
  }

  // Record initial webhook log
  await db.insert(webhookEvents).values({
    id: webhookId,
    provider: "corsair",
    status: "processing",
  });

  try {
    const result = await processWebhook(
      corsair,
      headers,
      body as string | Record<string, unknown>,
      { tenantId }
    );

    // Update webhook status
    await db
      .update(webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.id, webhookId));

    console.info("Plugin Processed:", result.plugin, result.action);

    // 3. AI Priority Classification + automation for Gmail. Runs before we ack
    // so automation actions (auto-reply, assignment) complete; Corsair retries
    // are safe because webhook_events makes processing idempotent.
    if (result.plugin === "gmail" && user) {
      await (async () => {
        const tenant = getTenant(tenantId);
        try {
          const messages = (await tenant.gmail.db.messages.list({ limit: 5 })) as CorsairMessage[];
          for (const msg of messages) {
            const existingMeta = await db.query.emailMeta.findFirst({
              where: eq(emailMeta.gmailMessageId, msg.entity_id),
            });

            if (!existingMeta) {
              let priority = "normal";
              let reason = "Auto-classified";
              let category = "important";
              let isVipSender = false;

              const { name, email } = parseSender(msg.data.from);

              // Upsert contact
              if (email) {
                await db.insert(contacts)
                  .values({
                    userId: user.id,
                    email,
                    name: name !== "" ? name : null,
                    interactionCount: 1,
                    lastInteractionAt: new Date(),
                  })
                  .onConflictDoUpdate({
                    target: [contacts.userId, contacts.email],
                    set: {
                      name: sql`COALESCE(EXCLUDED.name, contacts.name)`,
                      interactionCount: sql`contacts.interaction_count + 1`,
                      lastInteractionAt: new Date(),
                    }
                  });

                // Check VIP status
                const contact = await db.query.contacts.findFirst({
                  where: and(eq(contacts.userId, user.id), eq(contacts.email, email)),
                });
                
                if (contact?.isVip) {
                  priority = "high";
                  reason = `VIP Sender: ${name ?? email}`;
                  category = "important";
                  isVipSender = true;
                }
              }

              // Only call AI if sender is not VIP and API key is present
              if (!isVipSender && env.GEMINI_API_KEY) {
                try {
                  const prompt = `Classify the priority and category of the following email.
From: ${msg.data.from}
Subject: ${msg.data.subject}
Snippet: ${msg.data.snippet}`;

                  const { object } = await generateObject({
                    model: google("gemini-2.5-flash"),
                    schema: z.object({
                      priority: z.enum(["urgent", "high", "normal", "low"]),
                      reason: z.string(),
                      category: z.enum(["important", "other"]),
                    }),
                    prompt,
                  });

                  priority = object.priority;
                  reason = object.reason;
                  category = object.category;
                } catch (err) {
                  console.error("Gemini email classification failed:", err);
                }
              }

              await db.insert(emailMeta).values({
                userId: user.id,
                gmailMessageId: msg.entity_id,
                threadId: msg.data.threadId ?? "",
                priority,
                priorityReason: reason,
                category,
                isVipSender,
              });

              // 2.2 Create Support Ticket automatically
              if (msg.data.threadId && user.activeOrgId) {
                const existingTicket = await db.query.tickets.findFirst({
                  where: eq(tickets.threadId, msg.data.threadId),
                });
                let isNewTicket = false;
                if (!existingTicket) {
                  const countResult = await db.select({ count: sql<number>`count(*)` }).from(tickets).where(eq(tickets.orgId, user.activeOrgId));
                  const count = Number(countResult[0]?.count ?? 0);
                  const publicId = `GSN-${1000 + count + 1}`;

                  const { name: senderName, email: senderEmail } = parseSender(msg.data.from);

                  await db.insert(tickets).values({
                    orgId: user.activeOrgId,
                    publicId,
                    gmailMessageId: msg.entity_id,
                    threadId: msg.data.threadId,
                    subject: msg.data.subject ?? "No Subject",
                    snippet: msg.data.snippet ?? "",
                    status: "open",
                    fromEmail: senderEmail,
                    fromName: senderName,
                  });
                  isNewTicket = true;
                }

                // Fire outbound webhook for email.received
                const emailPayload = {
                  event: "email.received",
                  messageId: msg.entity_id,
                  threadId: msg.data.threadId,
                  subject: msg.data.subject ?? "No Subject",
                  from: msg.data.from,
                  to: msg.data.to,
                  snippet: msg.data.snippet,
                  priority,
                  category,
                  createdAt: new Date(),
                };
                await fireOutboundWebhook(user.activeOrgId, "email.received", emailPayload);

                if (isNewTicket) {
                  const ticketPayload = {
                    event: "ticket.created",
                    gmailMessageId: msg.entity_id,
                    threadId: msg.data.threadId,
                    subject: msg.data.subject ?? "No Subject",
                    fromEmail: parseSender(msg.data.from).email,
                    fromName: parseSender(msg.data.from).name,
                    status: "open",
                    createdAt: new Date(),
                  };
                  await fireOutboundWebhook(user.activeOrgId, "ticket.created", ticketPayload);
                }

                // Evaluate automation rules
                const activeRules = await db.query.rules.findMany({
                  where: and(
                    eq(rules.orgId, user.activeOrgId),
                    eq(rules.isActive, true)
                  ),
                });

                const msgSubject = msg.data.subject ?? "";
                const msgFrom = msg.data.from ?? "";
                const msgBody = msg.data.body ?? msg.data.snippet ?? "";

                for (const rule of activeRules) {
                  let conditionsParsed = [];
                  try {
                    conditionsParsed = JSON.parse(rule.conditions);
                  } catch (e) {
                    conditionsParsed = [];
                  }

                  const isMatch = matchConditions(
                    {
                      subject: msgSubject,
                      from: msgFrom,
                      body: msgBody,
                      priority: priority,
                    },
                    conditionsParsed
                  );

                  if (isMatch) {
                    const oneMinuteAgo = new Date(Date.now() - 60000);
                    const recentRunsCount = await db
                      .select({ count: sql<number>`count(*)` })
                      .from(automationRuns)
                      .where(
                        and(
                          eq(automationRuns.orgId, user.activeOrgId),
                          eq(automationRuns.ruleId, rule.id),
                          sql`${automationRuns.createdAt} > ${oneMinuteAgo}`
                        )
                      );
                    
                    const count = Number(recentRunsCount[0]?.count ?? 0);
                    if (count >= 10) {
                      console.warn(`Rate cap hit for rule ${rule.id} in org ${user.activeOrgId}`);
                      await db.insert(automationRuns).values({
                        orgId: user.activeOrgId,
                        ruleId: rule.id,
                        gmailMessageId: msg.entity_id,
                        status: "failed",
                        error: "Rate cap exceeded (loop/storm prevention)",
                      });
                      continue;
                    }

                    let actionsParsed = [];
                    try {
                      actionsParsed = JSON.parse(rule.actions);
                    } catch (e) {
                      actionsParsed = [];
                    }

                    const executed: any[] = [];
                    let hasError = false;
                    let errorMsg = "";

                    for (const action of actionsParsed) {
                      try {
                        if (action.type === "assign") {
                          await db
                            .update(tickets)
                            .set({ assignedUserId: action.value, updatedAt: new Date() })
                            .where(eq(tickets.threadId, msg.data.threadId));
                          executed.push({ type: "assign", value: action.value });
                        } else if (action.type === "change_status") {
                          await db
                            .update(tickets)
                            .set({ status: action.value, updatedAt: new Date() })
                            .where(eq(tickets.threadId, msg.data.threadId));
                          executed.push({ type: "change_status", value: action.value });
                        } else if (action.type === "add_label" || action.type === "tag") {
                          const ticket = await db.query.tickets.findFirst({
                            where: eq(tickets.threadId, msg.data.threadId),
                          });
                          const existingTags = ticket?.tags ? ticket.tags.split(",") : [];
                          if (!existingTags.includes(action.value)) {
                            existingTags.push(action.value);
                            await db
                              .update(tickets)
                              .set({ tags: existingTags.join(","), updatedAt: new Date() })
                              .where(eq(tickets.threadId, msg.data.threadId));
                          }
                          executed.push({ type: "add_label", value: action.value });
                        } else if (action.type === "auto_reply") {
                          const { email: senderEmail } = parseSender(msg.data.from);
                          if (senderEmail && user.corsairTenantId) {
                            const tenant = getTenant(user.corsairTenantId);
                            const replyBody = action.value;
                            const replyRaw = encodeRawEmail({
                              to: senderEmail,
                              subject: msgSubject.startsWith("Re: ") ? msgSubject : `Re: ${msgSubject}`,
                              body: replyBody,
                              inReplyTo: msg.entity_id,
                            });
                            await tenant.gmail.api.messages.send({
                              raw: replyRaw,
                              threadId: msg.data.threadId,
                            });
                            executed.push({ type: "auto_reply", value: action.value });
                          }
                        } else if (action.type === "webhook") {
                          const payload = {
                            event: "automation.triggered",
                            ruleId: rule.id,
                            ruleName: rule.name,
                            message: {
                              id: msg.entity_id,
                              threadId: msg.data.threadId,
                              from: msg.data.from,
                              subject: msg.data.subject,
                              snippet: msg.data.snippet,
                              priority: priority,
                            },
                          };
                          await fetch(action.value, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                          });
                          executed.push({ type: "webhook", value: action.value });
                        }
                      } catch (err: any) {
                        hasError = true;
                        errorMsg = err.message || "Action failed";
                        console.error(`Action failed in rule ${rule.id}:`, err);
                      }
                    }

                    await db.insert(automationRuns).values({
                      orgId: user.activeOrgId,
                      ruleId: rule.id,
                      gmailMessageId: msg.entity_id,
                      status: hasError ? "failed" : "success",
                      error: hasError ? errorMsg : null,
                      actionsExecuted: JSON.stringify(executed),
                    });
                  }
                }
              }

            }
          }
        } catch (err) {
          console.error("Failed to sync priority categorization:", err);
        }

        // 4. Trigger Real-time Event Push
        await publishUserEvent(user.id, {
          type: "inbox_update",
          message: "New email received and prioritized",
        });
      })();
    } else if (result.plugin === "googlecalendar" && user) {
      // Trigger Real-time Event Push for calendar
      await publishUserEvent(user.id, {
        type: "calendar_update",
        message: "Calendar updated",
      });
    }

    // Response headers handshake (e.g. secret validation)
    const responseHeaders = result.responseHeaders;
    const nextHeaders = new Headers();
    if (responseHeaders) {
      for (const [key, value] of Object.entries(responseHeaders)) {
        nextHeaders.set(key, value);
      }
    }

    if (!result.response) {
      return NextResponse.json(
        {
          success: false,
          message: "No matching webhook handler found",
        },
        { status: 404, headers: nextHeaders }
      );
    }

    return NextResponse.json(result.response, { headers: nextHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    console.error("Webhook processing failed:", message);

    await db
      .update(webhookEvents)
      .set({ status: "failed" })
      .where(eq(webhookEvents.id, webhookId));

    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
