import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { tickets, users, ticketEvents } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const ticketsRouter = createTRPCRouter({
  listTickets: orgProcedure.query(async ({ ctx }) => {
    const orgTickets = await db.query.tickets.findMany({
      where: eq(tickets.orgId, ctx.org.id),
      orderBy: (tickets, { desc }) => [desc(tickets.createdAt)],
    });

    const userIds = orgTickets
      .map((t) => t.assignedUserId)
      .filter((id): id is string => !!id);

    const dbUsers = userIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, userIds),
        })
      : [];

    const userMap = new Map(dbUsers.map((u) => [u.id, u]));

    return orgTickets.map((t) => ({
      ...t,
      assignedUser: t.assignedUserId ? userMap.get(t.assignedUserId) : null,
    }));
  }),

  updateTicketStatus: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(["open", "pending", "resolved"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.tickets.findFirst({
        where: and(
          eq(tickets.id, input.id),
          eq(tickets.orgId, ctx.org.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      }

      const [updated] = await db
        .update(tickets)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(tickets.id, input.id))
        .returning();

      return updated;
    }),

  assignTicket: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
        userId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.tickets.findFirst({
        where: and(
          eq(tickets.id, input.id),
          eq(tickets.orgId, ctx.org.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      }

      const [updated] = await db
        .update(tickets)
        .set({ assignedUserId: input.userId, updatedAt: new Date() })
        .where(eq(tickets.id, input.id))
        .returning();

      return updated;
    }),

  getNotes: orgProcedure
    .input(z.object({ ticketId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const existing = await db.query.tickets.findFirst({
        where: and(
          eq(tickets.id, input.ticketId),
          eq(tickets.orgId, ctx.org.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      }

      const events = await db.query.ticketEvents.findMany({
        where: eq(ticketEvents.ticketId, input.ticketId),
        orderBy: (events, { asc }) => [asc(events.createdAt)],
      });

      const userIds = events
        .map((e) => e.userId)
        .filter((id): id is string => !!id);

      const dbUsers = userIds.length > 0
        ? await db.query.users.findMany({
            where: inArray(users.id, userIds),
          })
        : [];

      const userMap = new Map(dbUsers.map((u) => [u.id, u]));

      return events.map((e) => ({
        ...e,
        user: e.userId ? userMap.get(e.userId) : null,
      }));
    }),

  addNote: orgProcedure
    .input(
      z.object({
        ticketId: z.string().min(1),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.tickets.findFirst({
        where: and(
          eq(tickets.id, input.ticketId),
          eq(tickets.orgId, ctx.org.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      }

      const [note] = await db
        .insert(ticketEvents)
        .values({
          ticketId: input.ticketId,
          userId: ctx.session.user.id,
          type: "note",
          content: input.content,
        })
        .returning();

      return note;
    }),
});

import { inArray } from "drizzle-orm";
