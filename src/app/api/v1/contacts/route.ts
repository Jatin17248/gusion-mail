import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiKey, hasScope } from "@/server/lib/api-auth";
import { errorMessage } from "@/server/lib/http";
import { db } from "@/server/db";
import { contacts, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const upsertSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  isVip: z.boolean().optional(),
  enrichment: z.unknown().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.scopes, "contacts:read")) {
    return NextResponse.json({ error: "Forbidden: missing contacts:read scope" }, { status: 403 });
  }

  const orgUsers = await db.query.users.findMany({
    where: eq(users.activeOrgId, auth.orgId),
  });
  const orgUserIds = orgUsers.map((u) => u.id);
  if (orgUserIds.length === 0) {
    return NextResponse.json({ success: true, contacts: [] });
  }

  try {
    const list = await db.query.contacts.findMany({
      where: (c, { inArray }) => inArray(c.userId, orgUserIds),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
    return NextResponse.json({ success: true, contacts: list });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to list contacts") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.scopes, "contacts:write")) {
    return NextResponse.json({ error: "Forbidden: missing contacts:write scope" }, { status: 403 });
  }

  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, name, isVip, enrichment } = parsed.data;

  const firstUser = await db.query.users.findFirst({
    where: eq(users.activeOrgId, auth.orgId),
  });
  if (!firstUser) {
    return NextResponse.json({ error: "No user found in organization" }, { status: 400 });
  }

  try {
    const enrichmentJson = enrichment !== undefined ? JSON.stringify(enrichment) : null;
    const [contact] = await db
      .insert(contacts)
      .values({
        userId: firstUser.id,
        email: email.toLowerCase().trim(),
        name: name ?? null,
        isVip: isVip ?? false,
        enrichment: enrichmentJson,
        interactionCount: 1,
        lastInteractionAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [contacts.userId, contacts.email],
        set: {
          name: name ?? undefined,
          isVip: isVip ?? undefined,
          enrichment: enrichmentJson ?? undefined,
          lastInteractionAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ success: true, contact });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to upsert contact") }, { status: 500 });
  }
}
