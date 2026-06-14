import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hasActivePlanOrTrial } from "@/server/lib/plan-gate";
import { trackEvent } from "@/lib/analytics";
import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { getTenant } from "@/server/lib/tenant";
import { db } from "@/server/db";
import { emailMeta } from "@/server/db/schema";
import { and, eq, gte, or } from "drizzle-orm";

async function verifyPremium(userId: string) {
  const isPremium = await hasActivePlanOrTrial(userId);
  if (!isPremium) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "This feature requires a premium plan or an active 14-day trial.",
    });
  }
}

export const aiRouter = createTRPCRouter({
  aiCompose: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        styleContext: z.string().optional(),
        tone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyPremium(ctx.session.user.id);
      trackEvent(ctx.session.user.id, "ai_compose_triggered", { promptLength: input.prompt.length });

      const systemPrompt = `You are an expert AI email writer. Write a clear, concise, and professional email body based on the instructions.
Do NOT output subject lines, headers, or signatures unless requested. Just write the email body.
${input.tone ? `Tone: ${input.tone}` : ""}
${input.styleContext ? `Writing Style / Context: ${input.styleContext}` : ""}`;

      const { text } = await generateText({
        model: google("gemini-2.5-flash"),
        system: systemPrompt,
        prompt: input.prompt,
      });

      return { text };
    }),

  aiSmartReply: protectedProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await verifyPremium(ctx.session.user.id);
      trackEvent(ctx.session.user.id, "ai_smart_reply_triggered", { messageId: input.messageId });

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      const dbMessage = await tenant.gmail.db.messages.findByEntityId(input.messageId);

      if (!dbMessage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email message not found.",
        });
      }

      const subject = dbMessage.data.subject ?? "No Subject";
      const from = dbMessage.data.from ?? "Unknown Sender";
      const body = dbMessage.data.body ?? dbMessage.data.snippet ?? "";

      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: z.object({
          replies: z
            .array(
              z.object({
                label: z.string().describe("Short 2-4 word label representing this option"),
                body: z.string().describe("The draft reply email body"),
              })
            )
            .length(3),
        }),
        prompt: `Based on the email thread context, generate exactly 3 smart reply suggestions.
Subject: ${subject}
From: ${from}
Email body:
${body}

Ensure that the reply drafts match the language and address the key points in the incoming email.`,
      });

      return object;
    }),

  aiSummarize: protectedProcedure
    .input(z.object({ threadId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await verifyPremium(ctx.session.user.id);
      trackEvent(ctx.session.user.id, "ai_summarize_triggered", { threadId: input.threadId });

      const tenant = getTenant(ctx.session.user.corsairTenantId);
      // Fetch thread messages
      const messages = await tenant.gmail.db.messages.search({
        data: {
          threadId: input.threadId,
        },
      });

      if (!messages || messages.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Thread messages not found.",
        });
      }

      // Sort chronologically
      const sortedMessages = [...messages].sort((a, b) => {
        const timeA = a.data.createdAt ? new Date(a.data.createdAt).getTime() : 0;
        const timeB = b.data.createdAt ? new Date(b.data.createdAt).getTime() : 0;
        return timeA - timeB;
      });

      const conversationText = sortedMessages
        .map((m, index) => {
          const sender = m.data.from ?? "Unknown";
          const body = m.data.body ?? m.data.snippet ?? "";
          return `[Message ${index + 1}] From: ${sender}\nBody:\n${body}\n---`;
        })
        .join("\n\n");

      const systemPrompt = `You are a helpful assistant. Summarize the following email thread into a clear, bulleted summary of key points and action items. Keep it concise.`;
      
      const { text } = await generateText({
        model: google("gemini-2.5-flash"),
        system: systemPrompt,
        prompt: conversationText,
      });

      return { summary: text };
    }),

  aiDailyBrief: protectedProcedure.query(async ({ ctx }) => {
    await verifyPremium(ctx.session.user.id);
    trackEvent(ctx.session.user.id, "ai_daily_brief_triggered");

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const highPriorityMetas = await db.query.emailMeta.findMany({
      where: and(
        eq(emailMeta.userId, ctx.session.user.id),
        or(eq(emailMeta.priority, "high"), eq(emailMeta.priority, "urgent")),
        gte(emailMeta.createdAt, twentyFourHoursAgo)
      ),
    });

    if (!highPriorityMetas || highPriorityMetas.length === 0) {
      return {
        brief: "You have no high-priority emails from the last 24 hours. You're all caught up!",
      };
    }

    const messageIds = highPriorityMetas.map((m) => m.gmailMessageId);
    const tenant = getTenant(ctx.session.user.corsairTenantId);
    const messages = await tenant.gmail.db.messages.findManyByEntityIds(messageIds);

    const formattedMessages = messages
      .map((m, index) => {
        const subject = m.data.subject ?? "No Subject";
        const from = m.data.from ?? "Unknown Sender";
        const snippet = m.data.snippet ?? "";
        return `[Email ${index + 1}]
Subject: ${subject}
From: ${from}
Summary/Snippet: ${snippet}
---`;
      })
      .join("\n\n");

    const prompt = `Below is a list of high-priority/urgent emails received in the last 24 hours. Generate a daily briefing summarizing these emails and highlighting key action items or decisions required.

List of Emails:
${formattedMessages}`;

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system: `You are an executive assistant. Summarize the high-priority emails received in the last 24 hours in a friendly, conversational daily brief format. Focus on what needs immediate attention today.`,
      prompt,
    });

    return { brief: text };
  }),
});
