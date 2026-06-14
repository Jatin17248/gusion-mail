import { type NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/server/lib/api-auth";
import { db } from "@/server/db";
import { tickets } from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.scopes.length > 0 && !auth.scopes.includes("tickets:read") && !auth.scopes.includes("*")) {
    return NextResponse.json({ error: "Forbidden: Missing tickets:read scope" }, { status: 403 });
  }

  try {
    const list = await db.query.tickets.findMany({
      where: eq(tickets.orgId, auth.orgId),
      orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
    });
    return NextResponse.json({ success: true, tickets: list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list tickets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.scopes.length > 0 && !auth.scopes.includes("tickets:write") && !auth.scopes.includes("*")) {
    return NextResponse.json({ error: "Forbidden: Missing tickets:write scope" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { subject, fromEmail, fromName, snippet, status } = body;
  if (!subject || !fromEmail) {
    return NextResponse.json({ error: "Missing required fields: subject, fromEmail" }, { status: 400 });
  }

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
        fromName: fromName || null,
        snippet: snippet || "",
        status: status || "open",
      })
      .returning();

    return NextResponse.json({ success: true, ticket: newTicket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create ticket" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const auth = await validateApiKey(authHeader);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.scopes.length > 0 && !auth.scopes.includes("tickets:write") && !auth.scopes.includes("*")) {
    return NextResponse.json({ error: "Forbidden: Missing tickets:write scope" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, status, assignedUserId, tags } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
  }

  try {
    const existing = await db.query.tickets.findFirst({
      where: and(eq(tickets.id, id), eq(tickets.orgId, auth.orgId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const updates: Partial<typeof tickets.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (status !== undefined) updates.status = status;
    if (assignedUserId !== undefined) updates.assignedUserId = assignedUserId;
    if (tags !== undefined) updates.tags = tags;

    const [updated] = await db
      .update(tickets)
      .set(updates)
      .where(eq(tickets.id, id))
      .returning();

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update ticket" }, { status: 500 });
  }
}
