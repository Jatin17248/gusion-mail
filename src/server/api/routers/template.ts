import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { templates } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const templateRouter = createTRPCRouter({
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    return await db.query.templates.findMany({
      where: eq(templates.userId, ctx.session.user.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }),

  createTemplate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        shortcut: z.string().min(1),
        subject: z.string().optional(),
        body: z.string().min(1),
        variables: z.string().optional(), // JSON string representing variables
        isShared: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [newTemplate] = await db
        .insert(templates)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          shortcut: input.shortcut,
          subject: input.subject ?? null,
          body: input.body,
          variables: input.variables ?? null,
          isShared: input.isShared,
        })
        .returning();

      return newTemplate;
    }),

  updateTemplate: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        shortcut: z.string().min(1),
        subject: z.string().optional(),
        body: z.string().min(1),
        variables: z.string().optional(),
        isShared: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedTemplate] = await db
        .update(templates)
        .set({
          name: input.name,
          shortcut: input.shortcut,
          subject: input.subject ?? null,
          body: input.body,
          variables: input.variables ?? null,
          isShared: input.isShared ?? false,
          updatedAt: new Date(),
        })
        .where(and(eq(templates.id, input.id), eq(templates.userId, ctx.session.user.id)))
        .returning();

      return updatedTemplate;
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(templates)
        .where(and(eq(templates.id, input.id), eq(templates.userId, ctx.session.user.id)));

      return { success: true };
    }),
});
