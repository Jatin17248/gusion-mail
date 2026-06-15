import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { savedSearches } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const searchRouter = createTRPCRouter({
  listSavedSearches: protectedProcedure.query(async ({ ctx }) => {
    return await db.query.savedSearches.findMany({
      where: eq(savedSearches.userId, ctx.session.user.id),
      orderBy: [desc(savedSearches.createdAt)],
    });
  }),

  createSavedSearch: protectedProcedure
    .input(z.object({ name: z.string().min(1), query: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [inserted] = await db
        .insert(savedSearches)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          query: input.query,
        })
        .returning();
      return inserted;
    }),

  deleteSavedSearch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(savedSearches)
        .where(
          eq(savedSearches.id, input.id) &&
            eq(savedSearches.userId, ctx.session.user.id)
        );
      return { success: true };
    }),
});
