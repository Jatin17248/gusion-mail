import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { sharedMailboxes, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const sharedMailboxRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
      columns: { activeOrgId: true },
    });

    if (!user?.activeOrgId) return [];

    return db.query.sharedMailboxes.findMany({
      where: eq(sharedMailboxes.orgId, user.activeOrgId),
    });
  }),

  create: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
        columns: { activeOrgId: true },
      });

      if (!user?.activeOrgId) throw new Error("No active organization");

      await db.insert(sharedMailboxes).values({
        orgId: user.activeOrgId,
        email: input.email,
        connectionStatus: "pending",
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
        columns: { activeOrgId: true },
      });

      if (!user?.activeOrgId) throw new Error("No active organization");

      await db
        .delete(sharedMailboxes)
        .where(
          and(
            eq(sharedMailboxes.id, input.id),
            eq(sharedMailboxes.orgId, user.activeOrgId)
          )
        );

      return { success: true };
    }),
});
