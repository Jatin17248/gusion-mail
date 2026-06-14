import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/server/lib/api-auth";
import { db } from "@/server/db";
import { rules, tickets, automationRuns, users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenant } from "@/server/lib/tenant";
import { encodeRawEmail } from "@/server/lib/email";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.scopes.length > 0 && !auth.scopes.includes("automations:trigger") && !auth.scopes.includes("*")) {
    return NextResponse.json({ error: "Forbidden: Missing automations:trigger scope" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ruleId, threadId, gmailMessageId, payload } = body;
  if (!ruleId) {
    return NextResponse.json({ error: "Missing required field: ruleId" }, { status: 400 });
  }

  try {
    const rule = await db.query.rules.findFirst({
      where: and(eq(rules.id, ruleId), eq(rules.orgId, auth.orgId)),
    });

    if (!rule) {
      return NextResponse.json({ error: "Automation rule not found" }, { status: 404 });
    }

    // Load first connected user for Corsair client
    const user = await db.query.users.findFirst({
      where: and(eq(users.activeOrgId, auth.orgId), eq(users.gmailConnected, true)),
    });

    if (!user) {
      return NextResponse.json({ error: "No connected Gmail account found for automation send action." }, { status: 400 });
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
        if (action.type === "assign" && threadId) {
          await db
            .update(tickets)
            .set({ assignedUserId: action.value, updatedAt: new Date() })
            .where(eq(tickets.threadId, threadId));
          executed.push({ type: "assign", value: action.value });
        } else if (action.type === "change_status" && threadId) {
          await db
            .update(tickets)
            .set({ status: action.value, updatedAt: new Date() })
            .where(eq(tickets.threadId, threadId));
          executed.push({ type: "change_status", value: action.value });
        } else if ((action.type === "add_label" || action.type === "tag") && threadId) {
          const ticket = await db.query.tickets.findFirst({
            where: eq(tickets.threadId, threadId),
          });
          const existingTags = ticket?.tags ? ticket.tags.split(",") : [];
          if (!existingTags.includes(action.value)) {
            existingTags.push(action.value);
            await db
              .update(tickets)
              .set({ tags: existingTags.join(","), updatedAt: new Date() })
              .where(eq(tickets.threadId, threadId));
          }
          executed.push({ type: "add_label", value: action.value });
        } else if (action.type === "auto_reply" && threadId && gmailMessageId) {
          const tenant = getTenant(user.corsairTenantId!);
          const replyRaw = encodeRawEmail({
            to: payload?.to || payload?.from || "",
            subject: payload?.subject || "Re: Ticket Update",
            body: action.value,
            inReplyTo: gmailMessageId,
          });
          await tenant.gmail.api.messages.send({
            raw: replyRaw,
            threadId: threadId,
          });
          executed.push({ type: "auto_reply", value: action.value });
        } else if (action.type === "webhook") {
          await fetch(action.value, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "automation.manual_trigger",
              ruleId: rule.id,
              ruleName: rule.name,
              payload,
            }),
          });
          executed.push({ type: "webhook", value: action.value });
        }
      } catch (err: any) {
        hasError = true;
        errorMsg = err.message || "Action execution failed";
      }
    }

    await db.insert(automationRuns).values({
      orgId: auth.orgId,
      ruleId: rule.id,
      gmailMessageId: gmailMessageId || null,
      status: hasError ? "failed" : "success",
      error: hasError ? errorMsg : null,
      actionsExecuted: JSON.stringify(executed),
    });

    return NextResponse.json({ success: !hasError, executed, error: hasError ? errorMsg : null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to trigger automation" }, { status: 500 });
  }
}
