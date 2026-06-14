import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/server/lib/api-auth";
import { db } from "@/server/db";
import { contacts, users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.scopes.length > 0 && !auth.scopes.includes("contacts:read") && !auth.scopes.includes("*")) {
    return NextResponse.json({ error: "Forbidden: Missing contacts:read scope" }, { status: 403 });
  }

  // Find users in the organization to query contacts for
  const orgUsers = await db.query.users.findMany({
    where: eq(users.activeOrgId, auth.orgId),
  });

  const orgUserIds = orgUsers.map((u) => u.id);

  if (orgUserIds.length === 0) {
    return NextResponse.json({ success: true, contacts: [] });
  }

  try {
    const list = await db.query.contacts.findMany({
      where: (contacts, { inArray }) => inArray(contacts.userId, orgUserIds),
      orderBy: (contacts, { desc }) => [desc(contacts.createdAt)],
    });
    return NextResponse.json({ success: true, contacts: list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list contacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.scopes.length > 0 && !auth.scopes.includes("contacts:write") && !auth.scopes.includes("*")) {
    return NextResponse.json({ error: "Forbidden: Missing contacts:write scope" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, name, isVip, enrichment } = body;
  if (!email) {
    return NextResponse.json({ error: "Missing required field: email" }, { status: 400 });
  }

  // Find a user in the org to assign the contact to
  const firstUser = await db.query.users.findFirst({
    where: eq(users.activeOrgId, auth.orgId),
  });

  if (!firstUser) {
    return NextResponse.json({ error: "No user found in organization" }, { status: 400 });
  }

  try {
    const [contact] = await db
      .insert(contacts)
      .values({
        userId: firstUser.id,
        email: email.toLowerCase().trim(),
        name: name || null,
        isVip: isVip || false,
        enrichment: enrichment ? JSON.stringify(enrichment) : null,
        interactionCount: 1,
        lastInteractionAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [contacts.userId, contacts.email],
        set: {
          name: name !== undefined ? name : undefined,
          isVip: isVip !== undefined ? isVip : undefined,
          enrichment: enrichment !== undefined ? JSON.stringify(enrichment) : undefined,
          lastInteractionAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ success: true, contact });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to upsert contact" }, { status: 500 });
  }
}
