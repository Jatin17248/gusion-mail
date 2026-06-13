import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { provisionCorsairTenant } from "@/server/lib/corsair-setup";
import { env } from "@/env";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return user;
  }),

  provisionTenant: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.session.user.corsairTenantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No Corsair tenant ID assigned to this user.",
      });
    }

    try {
      await provisionCorsairTenant(
        ctx.session.user.id,
        ctx.session.user.corsairTenantId,
        env.CORSAIR_KEK
      );
      return { success: true };
    } catch (error: unknown) {
      console.error("Failed to provision tenant:", error);
      const message = error instanceof Error ? error.message : "Failed to provision Corsair tenant.";
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message,
      });
    }
  }),
});
