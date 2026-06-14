import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { contacts } from "@/server/db/schema";
import { eq, and, like, or, desc } from "drizzle-orm";

export const contactsRouter = createTRPCRouter({
  listContacts: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        searchQuery: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const filters = [eq(contacts.userId, ctx.session.user.id)];

      if (input.searchQuery) {
        const queryPattern = `%${input.searchQuery}%`;
        filters.push(
          or(
            like(contacts.name, queryPattern),
            like(contacts.email, queryPattern)
          )!
        );
      }

      return await db.query.contacts.findMany({
        where: and(...filters),
        limit: input.limit,
        offset: input.offset,
        orderBy: [desc(contacts.interactionCount), desc(contacts.lastInteractionAt)],
      });
    }),

  toggleVip: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        isVip: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(contacts)
        .set({ isVip: input.isVip })
        .where(and(eq(contacts.email, input.email), eq(contacts.userId, ctx.session.user.id)))
        .returning();

      return updated;
    }),
});
