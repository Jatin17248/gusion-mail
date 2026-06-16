import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { connectedAccounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const connectedAccountsRouter = createTRPCRouter({
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return db.query.connectedAccounts.findMany({
      where: eq(connectedAccounts.userId, ctx.session.user.id),
      orderBy: (accounts, { desc }) => [desc(accounts.createdAt)],
    });
  }),

  setDefault: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First verify the account belongs to the user
      const account = await db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.id, input.accountId),
          eq(connectedAccounts.userId, ctx.session.user.id)
        ),
      });

      if (!account) {
        throw new Error("Account not found");
      }

      // Start transaction to update defaults safely
      await db.transaction(async (tx) => {
        // Reset all to false
        await tx
          .update(connectedAccounts)
          .set({ isDefault: false })
          .where(eq(connectedAccounts.userId, ctx.session.user.id));

        // Set the chosen one to true
        await tx
          .update(connectedAccounts)
          .set({ isDefault: true })
          .where(eq(connectedAccounts.id, input.accountId));
      });

      return { success: true };
    }),
});
