import { processWebhook } from "corsair";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { db } from "@/server/db";
import { users, emailMeta, webhookEvents, contacts } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { env } from "@/env";
import { appEventEmitter } from "@/server/lib/event-emitter";
import { getTenant } from "@/server/lib/tenant";

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

  // Resolve tenantId dynamically from query parameters (fallback to 'dev')
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? "dev";

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

    // 3. AI Priority Classification for Gmail
    if (result.plugin === "gmail" && user) {
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
          }
        }
      } catch (err) {
        console.error("Failed to sync priority categorization:", err);
      }

      // 4. Trigger Real-time Event Push
      appEventEmitter.emit(`update:${user.id}`, {
        type: "inbox_update",
        message: "New email received and prioritized",
      });
    } else if (result.plugin === "googlecalendar" && user) {
      // Trigger Real-time Event Push for calendar
      appEventEmitter.emit(`update:${user.id}`, {
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
