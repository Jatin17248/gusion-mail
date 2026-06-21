import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { hasActivePlanOrTrial } from "@/server/lib/plan-gate";
import { trackEvent } from "@/lib/analytics";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { env } from "@/env";
import { getTenant } from "@/server/lib/tenant";

const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY ?? "" });
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
  aiCalendarAssist: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyPremium(ctx.session.user.id);
      trackEvent(ctx.session.user.id, "ai_calendar_assist_triggered", {
        promptLength: input.prompt.length,
      });

      const now = new Date();

      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: z.object({
          summary: z.string().describe("Short event title"),
          description: z.string().optional().describe("Optional event description"),
          location: z.string().optional().describe("Optional event location"),
          start: z.string().describe("ISO 8601 datetime string for the event start"),
          end: z.string().describe("ISO 8601 datetime string for the event end"),
          attendees: z
            .array(z.string().email())
            .describe("List of attendee email addresses, or an empty array if none were provided"),
        }),
        system: `You turn natural-language scheduling requests into structured calendar event drafts.
Current time: ${now.toISOString()}.
User timezone: Asia/Kolkata.

Rules:
- Always return valid ISO datetime strings for start and end.
- If the user gives only a start time and no end time, default to a 1 hour duration.
- If the user implies a Google Meet, use "Google Meet" as the location unless a more specific location is given.
- Keep the event title concise and polished.
- Only include attendee emails explicitly mentioned or clearly inferable from the prompt.
- If no attendees are provided, return an empty array.
- If the prompt is vague, make the safest reasonable assumption rather than leaving fields blank.`,
        prompt: input.prompt,
      });

      return object;
    }),

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

      const userName = ctx.session.user.name ?? "";

      const systemPrompt = `You are an expert email writer drafting a complete, ready-to-send email on behalf of ${userName || "the user"} from a short instruction.

Write a well-structured, professional email:
- Open with an appropriate greeting. Use the recipient's name if the instruction names them; otherwise use a neutral greeting such as "Hi there,".
- Write 2-4 clear, well-organized paragraphs that fully develop the intent of the instruction. Use a short bulleted list when it improves readability.
- Make the purpose and any request or next step explicit and easy to act on.
- Keep a polished, professional, and warm tone. Be specific and substantive — avoid filler and one-line emails.
- Close with a suitable sign-off on its own line, followed by "${userName || "[Your name]"}".
- Do NOT invent specific facts, figures, dates, or commitments that aren't implied by the instruction; use light placeholders like [date] or [link] only when genuinely needed.
${input.tone ? `\nDesired tone: ${input.tone}` : ""}
${input.styleContext ? `\nWriting style / context to emulate: ${input.styleContext}` : ""}`;

      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: z.object({
          subject: z.string().describe("A concise, specific email subject line (no more than 10 words)"),
          body: z
            .string()
            .describe(
              "The complete email body: greeting, multiple well-structured paragraphs, and a professional sign-off with the sender's name",
            ),
        }),
        system: systemPrompt,
        prompt: `Write the email for this instruction:\n\n${input.prompt}`,
      });

      return object;
    }),

  // Smart Compose: suggest a short continuation of the email being written.
  aiAutocomplete: protectedProcedure
    .input(
      z.object({
        body: z.string(),
        subject: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyPremium(ctx.session.user.id);
      if (input.body.trim().length < 3) return { completion: "" };

      const { text } = await generateText({
        model: google("gemini-2.5-flash"),
        system: `You are an email autocomplete engine, like Gmail Smart Compose.
Continue the user's email naturally from exactly where it ends.
Rules:
- Return ONLY the continuation text that should follow — never repeat what's already written.
- Keep it short: at most one sentence (~15 words).
- Match the existing tone, language, and formatting.
- Do not add greetings, sign-offs, or signatures.
- If the email already reads as complete, return an empty string.`,
        prompt: `Subject: ${input.subject ?? ""}\n\nEmail so far:\n${input.body}\n\nContinuation:`,
      });

      return { completion: text.trim() };
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
      const userName = ctx.session.user.name ?? "";

      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: z.object({
          replies: z
            .array(
              z.object({
                label: z
                  .string()
                  .describe(
                    "Short 2-4 word label summarizing the stance of this reply (e.g. 'Accept & schedule', 'Ask for details')",
                  ),
                body: z
                  .string()
                  .describe(
                    "A complete, professional, ready-to-send email reply (multiple short paragraphs), including greeting and sign-off",
                  ),
              })
            )
            .length(3),
        }),
        system: `You are an expert executive assistant who drafts polished, professional email replies on behalf of ${userName || "the user"}.

Each reply MUST be a complete, ready-to-send email — never a one-line snippet. For every reply:
- Open with an appropriate greeting using the sender's first name when it can be inferred.
- Write 2-4 concise paragraphs (use a short bulleted list when it improves clarity) that directly address the key points, questions, and any action items in the incoming email.
- Keep a professional, warm, and confident tone; be clear and courteous.
- Close with a suitable sign-off on its own line, followed by "${userName || "[Your name]"}".
- Match the language of the incoming email.
- Do NOT include a subject line. Do NOT invent specific facts, figures, dates, or commitments that aren't supported by the email — keep unknowns general or use a light placeholder like [date] only when necessary.

Return exactly 3 DISTINCT options that take different stances, for example: (1) a positive/affirmative reply that moves things forward, (2) a reply that asks clarifying questions or requests more detail, and (3) a polite deferral or an alternative proposal.`,
        prompt: `Draft 3 reply options to the email below.

From: ${from}
Subject: ${subject}

Email body:
${body}`,
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
