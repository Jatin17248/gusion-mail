import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { agentMessages } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const agentRouter = createTRPCRouter({
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const messages = await db.query.agentMessages.findMany({
      where: eq(agentMessages.userId, ctx.session.user.id),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });

    return messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system" | "tool",
      content: m.content ?? "",
      toolCalls: m.toolCalls ? (JSON.parse(m.toolCalls) as unknown) : undefined,
      createdAt: m.createdAt,
    }));
  }),

  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .delete(agentMessages)
      .where(eq(agentMessages.userId, ctx.session.user.id));
    return { success: true };
  }),
});
