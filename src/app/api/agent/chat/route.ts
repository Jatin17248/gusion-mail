import { google } from "@ai-sdk/google";
import { streamText, tool, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getTenant } from "@/server/lib/tenant";
import { db } from "@/server/db";
import { agentMessages } from "@/server/db/schema";
import { trackEvent } from "@/lib/analytics";

interface CorsairMessage {
  entity_id: string;
  data: {
    threadId?: string;
    snippet?: string;
    subject?: string;
    from?: string;
    to?: string;
    body?: string;
    internalDate?: string;
    createdAt?: Date | null;
  };
}

interface CorsairEvent {
  entity_id: string;
  data: {
    summary?: string;
    description?: string;
    location?: string;
    status?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: { email?: string; displayName?: string }[];
    createdAt?: Date | null;
  };
}

export const maxDuration = 60; // 60 seconds

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.corsairTenantId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages } = await req.json() as { messages: UIMessage[] };

  // Save user message to DB
  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage?.role === "user") {
    const textContent = lastUserMessage.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n") ?? "";

    await db.insert(agentMessages).values({
      userId: session.user.id,
      role: lastUserMessage.role,
      content: textContent,
      createdAt: new Date(),
    });

    trackEvent(session.user.id, "agent_chat_sent", { messageLength: textContent.length });
  }

  const tenant = getTenant(session.user.corsairTenantId);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    messages: await convertToModelMessages(messages),
    system: `You are Gusion, the keyboard-first AI email and calendar assistant. 
You help the user triage their inbox, reply to emails, and schedule events.
You are running under the user's secure tenant: ${session.user.corsairTenantId}.
Current local time is: ${new Date().toISOString()}.

RULES:
1. When the user asks to send an email, reply to an email, or create a calendar event, you MUST call the corresponding 'propose' tool (e.g. 'proposeEmail' or 'proposeCalendarEvent').
2. Do NOT send emails or create events directly. Instead, propose them first to let the user approve them in the UI.
3. For searching or reading emails/events, call the list/search tools directly and display the results cleanly to the user.
4. Keep your responses concise and action-oriented.`,
    tools: {
      searchEmails: tool({
        description: "Search user emails by query string.",
        inputSchema: z.object({
          query: z.string().describe("The search query (e.g. sender, subject, keywords)"),
        }),
        execute: async ({ query }: { query: string }) => {
          const messages = (await tenant.gmail.db.messages.search({
            data: {
              snippet: { contains: query },
            },
            limit: 10,
          })) as CorsairMessage[];
          return messages.map((m) => ({
            id: m.entity_id,
            threadId: m.data.threadId ?? "",
            snippet: m.data.snippet ?? "",
            subject: m.data.subject ?? "",
            from: m.data.from ?? "",
            to: m.data.to ?? "",
            date: m.data.internalDate ?? null,
          }));
        },
      }),

      getEmailDetails: tool({
        description: "Get full details (including body) of a specific email message.",
        inputSchema: z.object({
          messageId: z.string().describe("The unique message ID"),
        }),
        execute: async ({ messageId }: { messageId: string }) => {
          const message = (await tenant.gmail.db.messages.findByEntityId(messageId)) as CorsairMessage | undefined;
          if (!message) return { error: "Email not found" };
          return {
            id: message.entity_id,
            threadId: message.data.threadId ?? "",
            subject: message.data.subject ?? "",
            from: message.data.from ?? "",
            to: message.data.to ?? "",
            body: message.data.body ?? message.data.snippet ?? "",
            snippet: message.data.snippet ?? "",
            date: message.data.internalDate ?? null,
          };
        },
      }),

      listEvents: tool({
        description: "List calendar events for a specific timeframe.",
        inputSchema: z.object({
          timeMin: z.string().describe("ISO datetime string for start time"),
          timeMax: z.string().describe("ISO datetime string for end time"),
        }),
        execute: async ({ timeMin, timeMax }: { timeMin: string; timeMax: string }) => {
          const events = (await tenant.googlecalendar.db.events.list({
            limit: 50,
          })) as CorsairEvent[];
          // Filter by time range
          const startMs = new Date(timeMin).getTime();
          const endMs = new Date(timeMax).getTime();
          return events
            .filter((e) => {
              const startStr = e.data.start?.dateTime ?? e.data.start?.date;
              if (!startStr) return false;
              const ms = new Date(startStr).getTime();
              return ms >= startMs && ms <= endMs;
            })
            .map((e) => ({
              id: e.entity_id,
              summary: e.data.summary ?? "",
              start: e.data.start?.dateTime ?? e.data.start?.date ?? "",
              end: e.data.end?.dateTime ?? e.data.end?.date ?? "",
              attendees: e.data.attendees?.map((a) => a.email).filter(Boolean) ?? [],
            }));
        },
      }),

      proposeEmail: tool({
        description: "Draft an email to send or reply. This will require user confirmation on the UI before sending.",
        inputSchema: z.object({
          to: z.string().email().describe("Recipient email address"),
          subject: z.string().describe("Email subject line"),
          body: z.string().describe("Plain text body of the email"),
          threadId: z.string().optional().describe("Thread ID if replying to an existing thread"),
          inReplyTo: z.string().optional().describe("Message ID of the email being replied to"),
          references: z.string().optional().describe("References header of the email thread"),
        }),
        execute: async (args: {
          to: string;
          subject: string;
          body: string;
          threadId?: string;
          inReplyTo?: string;
          references?: string;
        }) => {
          return {
            status: "requires_confirmation",
            proposalType: "email",
            data: args,
          };
        },
      }),

      proposeCalendarEvent: tool({
        description: "Draft a calendar event to create. This will require user confirmation on the UI before scheduling.",
        inputSchema: z.object({
          summary: z.string().describe("Event title / summary"),
          description: z.string().optional().describe("Event description"),
          location: z.string().optional().describe("Event location"),
          start: z.string().describe("ISO datetime string for start time"),
          end: z.string().describe("ISO datetime string for end time"),
          attendees: z.array(z.string().email()).optional().describe("List of attendee email addresses"),
        }),
        execute: async (args: {
          summary: string;
          description?: string;
          location?: string;
          start: string;
          end: string;
          attendees?: string[];
        }) => {
          return {
            status: "requires_confirmation",
            proposalType: "event",
            data: args,
          };
        },
      }),

      archiveEmail: tool({
        description: "Archive an email (removes it from Inbox). Runs immediately.",
        inputSchema: z.object({
          messageId: z.string().describe("The unique message ID to archive"),
        }),
        execute: async ({ messageId }: { messageId: string }) => {
          await tenant.gmail.api.messages.modify({
            id: messageId,
            removeLabelIds: ["INBOX"],
          });
          return { success: true };
        },
      }),

      markRead: tool({
        description: "Mark an email as read or unread. Runs immediately.",
        inputSchema: z.object({
          messageId: z.string().describe("The message ID"),
          read: z.boolean().describe("true to mark read, false to mark unread"),
        }),
        execute: async ({ messageId, read }: { messageId: string; read: boolean }) => {
          if (read) {
            await tenant.gmail.api.messages.modify({
              id: messageId,
              removeLabelIds: ["UNREAD"],
            });
          } else {
            await tenant.gmail.api.messages.modify({
              id: messageId,
              addLabelIds: ["UNREAD"],
            });
          }
          return { success: true };
        },
      }),
    },
    onFinish: async ({ text, toolCalls }) => {
      // Save assistant response to DB
      await db.insert(agentMessages).values({
        userId: session.user.id,
        role: "assistant",
        content: text ?? null,
        toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
        createdAt: new Date(),
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
