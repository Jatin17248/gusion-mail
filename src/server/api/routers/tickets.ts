import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { tickets, users } from "@/server/db/schema";
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
});

import { inArray } from "drizzle-orm";
