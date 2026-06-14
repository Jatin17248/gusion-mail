import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { rules, automationRuns } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const automationRouter = createTRPCRouter({
  listRules: orgProcedure.query(async ({ ctx }) => {
    return await db.query.rules.findMany({
      where: eq(rules.orgId, ctx.org.id),
      orderBy: [desc(rules.createdAt)],
    });
  }),

  createRule: orgProcedure
    .input(
      z.object({
        name: z.string().min(1),
        triggerType: z.string().default("email_received"),
        conditions: z.string(), // JSON string representing Condition[]
        actions: z.string(), // JSON string representing Action[]
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [newRule] = await db
        .insert(rules)
        .values({
          orgId: ctx.org.id,
          name: input.name,
          triggerType: input.triggerType,
          conditions: input.conditions,
          actions: input.actions,
          isActive: true,
        })
        .returning();

      return newRule;
    }),

  updateRule: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        conditions: z.string().optional(),
        actions: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.rules.findFirst({
        where: and(eq(rules.id, input.id), eq(rules.orgId, ctx.org.id)),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found." });
      }

      const [updated] = await db
        .update(rules)
        .set({
          name: input.name ?? existing.name,
          isActive: input.isActive ?? existing.isActive,
          conditions: input.conditions ?? existing.conditions,
          actions: input.actions ?? existing.actions,
          updatedAt: new Date(),
        })
        .where(eq(rules.id, input.id))
        .returning();

      return updated;
    }),

  deleteRule: orgProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.rules.findFirst({
        where: and(eq(rules.id, input.id), eq(rules.orgId, ctx.org.id)),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found." });
      }

      await db.delete(rules).where(eq(rules.id, input.id));
      return { success: true };
    }),

  listRuns: orgProcedure.query(async ({ ctx }) => {
    return await db.query.automationRuns.findMany({
      where: eq(automationRuns.orgId, ctx.org.id),
      orderBy: [desc(automationRuns.createdAt)],
      limit: 100,
    });
  }),
});
