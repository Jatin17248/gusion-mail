import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiKey, hasScope } from "@/server/lib/api-auth";
import { errorMessage } from "@/server/lib/http";
import { db } from "@/server/db";
import { tickets } from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";

const createSchema = z.object({
  subject: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
  snippet: z.string().optional(),
  status: z.string().optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  assignedUserId: z.string().optional(),
  tags: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.scopes, "tickets:read")) {
    return NextResponse.json({ error: "Forbidden: missing tickets:read scope" }, { status: 403 });
  }

  try {
    const list = await db.query.tickets.findMany({
      where: eq(tickets.orgId, auth.orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return NextResponse.json({ success: true, tickets: list });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to list tickets") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.scopes, "tickets:write")) {
    return NextResponse.json({ error: "Forbidden: missing tickets:write scope" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { subject, fromEmail, fromName, snippet, status } = parsed.data;

  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(eq(tickets.orgId, auth.orgId));

    const count = Number(countResult[0]?.count ?? 0);
    const publicId = `GSN-${1000 + count + 1}`;

    const [newTicket] = await db
      .insert(tickets)
      .values({
        orgId: auth.orgId,
        publicId,
        subject,
        fromEmail: fromEmail.toLowerCase().trim(),
        fromName: fromName ?? null,
        snippet: snippet ?? "",
        status: status ?? "open",
      })
      .returning();

    return NextResponse.json({ success: true, ticket: newTicket });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to create ticket") }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasScope(auth.scopes, "tickets:write")) {
    return NextResponse.json({ error: "Forbidden: missing tickets:write scope" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id, status, assignedUserId, tags } = parsed.data;

  try {
    const existing = await db.query.tickets.findFirst({
      where: and(eq(tickets.id, id), eq(tickets.orgId, auth.orgId)),
    });
    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const updates: Partial<typeof tickets.$inferInsert> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (assignedUserId !== undefined) updates.assignedUserId = assignedUserId;
    if (tags !== undefined) updates.tags = tags;

    const [updated] = await db
      .update(tickets)
      .set(updates)
      .where(and(eq(tickets.id, id), eq(tickets.orgId, auth.orgId)))
      .returning();

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, "Failed to update ticket") }, { status: 500 });
  }
}
