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

  addContact: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        isVip: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.email, input.email),
          eq(contacts.userId, ctx.session.user.id)
        ),
      });
      if (existing) {
        const [updated] = await db
          .update(contacts)
          .set({
            isVip: input.isVip,
            name: input.name ?? existing.name,
          })
          .where(eq(contacts.id, existing.id))
          .returning();
        return updated;
      }
      const [inserted] = await db
        .insert(contacts)
        .values({
          userId: ctx.session.user.id,
          email: input.email,
          name: input.name ?? null,
          isVip: input.isVip,
        })
        .returning();
      return inserted;
    }),

  getContactByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.email, input.email),
          eq(contacts.userId, ctx.session.user.id)
        ),
      });
      return contact ?? null;
    }),
});
