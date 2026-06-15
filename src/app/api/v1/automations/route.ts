import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiKey, hasScope } from "@/server/lib/api-auth";
import { errorMessage } from "@/server/lib/http";
import {
  parseAutomationActions,
  type AutomationAction,
} from "@/server/lib/automation";
import { db } from "@/server/db";
import { rules, tickets, automationRuns, users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenant } from "@/server/lib/tenant";
import { encodeRawEmail } from "@/server/lib/email";

const triggerSchema = z.object({
  ruleId: z.string().min(1),
  threadId: z.string().optional(),
  gmailMessageId: z.string().optional(),
  payload: z
    .object({
      to: z.string().optional(),
      from: z.string().optional(),
      subject: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.scopes, "automations:trigger")) {
    return NextResponse.json({ error: "Forbidden: missing automations:trigger scope" }, { status: 403 });
  }

  const parsed = triggerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { ruleId, threadId, gmailMessageId, payload } = parsed.data;

  try {
    const rule = await db.query.rules.findFirst({
      where: and(eq(rules.id, ruleId), eq(rules.orgId, auth.orgId)),
    });
    if (!rule) {
      return NextResponse.json({ error: "Automation rule not found" }, { status: 404 });
    }

    const user = await db.query.users.findFirst({
      where: and(eq(users.activeOrgId, auth.orgId), eq(users.gmailConnected, true)),
    });
    if (!user) {
      return NextResponse.json({ error: "No connected Gmail account found for automation send action." }, { status: 400 });
    }

    const actions = parseAutomationActions(rule.actions);
    const executed: AutomationAction[] = [];
    let hasError = false;
    let errorMsg = "";

    for (const action of actions) {
      try {
        if (action.type === "assign" && threadId) {
          await db
            .update(tickets)
            .set({ assignedUserId: action.value, updatedAt: new Date() })
            .where(and(eq(tickets.threadId, threadId), eq(tickets.orgId, auth.orgId)));
          executed.push(action);
        } else if (action.type === "change_status" && threadId) {
          await db
            .update(tickets)
            .set({ status: action.value, updatedAt: new Date() })
            .where(and(eq(tickets.threadId, threadId), eq(tickets.orgId, auth.orgId)));
          executed.push(action);
        } else if ((action.type === "add_label" || action.type === "tag") && threadId) {
          const ticket = await db.query.tickets.findFirst({
            where: and(eq(tickets.threadId, threadId), eq(tickets.orgId, auth.orgId)),
          });
          const existingTags = ticket?.tags ? ticket.tags.split(",") : [];
          if (!existingTags.includes(action.value)) {
            existingTags.push(action.value);
            await db
              .update(tickets)
              .set({ tags: existingTags.join(","), updatedAt: new Date() })
              .where(and(eq(tickets.threadId, threadId), eq(tickets.orgId, auth.orgId)));
          }
          executed.push(action);
        } else if (action.type === "auto_reply" && threadId && gmailMessageId) {
          const tenant = getTenant(user.corsairTenantId);
          const replyRaw = encodeRawEmail({
            to: payload?.to ?? payload?.from ?? "",
            subject: payload?.subject ?? "Re: Ticket Update",
            body: action.value,
            inReplyTo: gmailMessageId,
          });
          await tenant.gmail.api.messages.send({ raw: replyRaw, threadId });
          executed.push(action);
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
          executed.push(action);
        }
      } catch (err) {
        hasError = true;
        errorMsg = errorMessage(err, "Action execution failed");
      }
    }

    await db.insert(automationRuns).values({
      orgId: auth.orgId,
      ruleId: rule.id,
      gmailMessageId: gmailMessageId ?? null,
      status: hasError ? "failed" : "success",
      error: hasError ? errorMsg : null,
      actionsExecuted: JSON.stringify(executed),
    });

    return NextResponse.json({ success: !hasError, executed, error: hasError ? errorMsg : null });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to trigger automation") }, { status: 500 });
  }
}
