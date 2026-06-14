import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/server/lib/api-auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenant } from "@/server/lib/tenant";
import { encodeRawEmail } from "@/server/lib/email";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check scopes
  if (auth.scopes.length > 0 && !auth.scopes.includes("messages:read") && !auth.scopes.includes("*")) {
    return NextResponse.json({ error: "Forbidden: Missing messages:read scope" }, { status: 403 });
  }

  // Find a connected gmail user for the org
  const user = await db.query.users.findFirst({
    where: and(eq(users.activeOrgId, auth.orgId), eq(users.gmailConnected, true)),
  });

  if (!user?.corsairTenantId) {
    return NextResponse.json({ error: "No connected Gmail account found for this organization." }, { status: 400 });
  }

  try {
    const tenant = getTenant(user.corsairTenantId);
    const messages = await tenant.gmail.db.messages.list({ limit: 50 });
    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.scopes.length > 0 && !auth.scopes.includes("messages:send") && !auth.scopes.includes("*")) {
    return NextResponse.json({ error: "Forbidden: Missing messages:send scope" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, subject, body: emailBody } = body;
  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: "Missing required fields: to, subject, body" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.activeOrgId, auth.orgId), eq(users.gmailConnected, true)),
  });

  if (!user?.corsairTenantId) {
    return NextResponse.json({ error: "No connected Gmail account found for this organization." }, { status: 400 });
  }

  try {
    const tenant = getTenant(user.corsairTenantId);
    const raw = encodeRawEmail({ to, subject, body: emailBody });
    const message = await tenant.gmail.api.messages.send({ raw });
    return NextResponse.json({ success: true, messageId: message.id, threadId: message.threadId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send message" }, { status: 500 });
  }
}
