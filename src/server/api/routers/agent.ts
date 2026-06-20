import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { agentMessages } from "@/server/db/schema";
import { eq, and, like } from "drizzle-orm";
import { z } from "zod";

export const agentRouter = createTRPCRouter({
  getHistory: protectedProcedure
    .input(z.object({ sessionId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where = input?.sessionId
        ? and(
            eq(agentMessages.userId, ctx.session.user.id),
            eq(agentMessages.sessionId, input.sessionId)
          )
        : eq(agentMessages.userId, ctx.session.user.id);

      const messages = await db.query.agentMessages.findMany({
        where,
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      });

      return messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system" | "tool",
        content: m.content ?? "",
        toolCalls: m.toolCalls ? (JSON.parse(m.toolCalls) as unknown) : undefined,
        createdAt: m.createdAt,
        sessionId: m.sessionId,
      }));
    }),

  getSessions: protectedProcedure.query(async ({ ctx }) => {
    const messages = await db.query.agentMessages.findMany({
      where: eq(agentMessages.userId, ctx.session.user.id),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
      columns: { id: true, sessionId: true, role: true, content: true, createdAt: true },
    });

    const sessions = new Map<string, {
      sessionId: string;
      title: string;
      lastAt: Date;
      messageCount: number;
    }>();

    for (const msg of messages) {
      if (!msg.sessionId) continue;
      if (!sessions.has(msg.sessionId)) {
        sessions.set(msg.sessionId, {
          sessionId: msg.sessionId,
          title: msg.role === "user" ? (msg.content ?? "").slice(0, 80) : "",
          lastAt: msg.createdAt,
          messageCount: 1,
        });
      } else {
        const s = sessions.get(msg.sessionId)!;
        s.messageCount++;
        s.lastAt = msg.createdAt;
        if (!s.title && msg.role === "user") {
          s.title = (msg.content ?? "").slice(0, 80);
        }
      }
    }

    return Array.from(sessions.values())
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
      .slice(0, 50);
  }),

  searchHistory: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!input.query.trim()) return [];
      const messages = await db.query.agentMessages.findMany({
        where: and(
          eq(agentMessages.userId, ctx.session.user.id),
          like(agentMessages.content, `%${input.query}%`)
        ),
        orderBy: (m, { desc }) => [desc(m.createdAt)],
        limit: 50,
      });
      return messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content ?? "",
        createdAt: m.createdAt,
      }));
    }),

  clearHistory: protectedProcedure
    .input(z.object({ sessionId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const where = input?.sessionId
        ? and(
            eq(agentMessages.userId, ctx.session.user.id),
            eq(agentMessages.sessionId, input.sessionId)
          )
        : eq(agentMessages.userId, ctx.session.user.id);

      await db.delete(agentMessages).where(where);
      return { success: true };
    }),
});
