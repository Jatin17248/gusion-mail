import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiKey, hasScope } from "@/server/lib/api-auth";
import { errorMessage } from "@/server/lib/http";
import type { CorsairMessage } from "@/server/lib/corsair-types";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenant } from "@/server/lib/tenant";
import { encodeRawEmail } from "@/server/lib/email";

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.scopes, "messages:read")) {
    return NextResponse.json({ error: "Forbidden: missing messages:read scope" }, { status: 403 });
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.activeOrgId, auth.orgId), eq(users.gmailConnected, true)),
  });
  if (!user?.corsairTenantId) {
    return NextResponse.json({ error: "No connected Gmail account found for this organization." }, { status: 400 });
  }

  try {
    const tenant = getTenant(user.corsairTenantId);
    const messages = (await tenant.gmail.db.messages.list({ limit: 50 })) as CorsairMessage[];
    const data = messages.map((m) => ({
      id: m.entity_id,
      threadId: m.data.threadId ?? "",
      from: m.data.from ?? "",
      to: m.data.to ?? "",
      subject: m.data.subject ?? "",
      snippet: m.data.snippet ?? "",
      date: m.data.internalDate ?? null,
    }));
    return NextResponse.json({ success: true, messages: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to list messages") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.scopes, "messages:send")) {
    return NextResponse.json({ error: "Forbidden: missing messages:send scope" }, { status: 403 });
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.activeOrgId, auth.orgId), eq(users.gmailConnected, true)),
  });
  if (!user?.corsairTenantId) {
    return NextResponse.json({ error: "No connected Gmail account found for this organization." }, { status: 400 });
  }

  try {
    const tenant = getTenant(user.corsairTenantId);
    const raw = encodeRawEmail({
      to: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    const message = await tenant.gmail.api.messages.send({ raw });
    return NextResponse.json({ success: true, messageId: message.id, threadId: message.threadId });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to send message") }, { status: 500 });
  }
}
