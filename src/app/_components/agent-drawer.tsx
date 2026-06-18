"use client";

import React, { useEffect, useRef } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { api } from "@/trpc/react";
import {
  X,
  Sparkles,
  Send,
  Trash2,
  Mail,
  Calendar as CalendarIcon,
  Check,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import { toast } from "sonner";

interface AgentDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface EmailProposalData {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

interface EventProposalData {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: string[];
}

interface ToolInvPart {
  type: string;
  toolCallId: string;
  output?: {
    status: string;
    proposalType: string;
    data: unknown;
  };
}

export function AgentDrawer({ open, onClose }: AgentDrawerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // tRPC query to fetch initial history
  const { data: history } = api.agent.getHistory.useQuery(
    undefined,
    {
      enabled: open,
      refetchOnWindowFocus: false,
    }
  );

  const clearHistoryMutation = api.agent.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([]);
      toast.success("Chat history cleared");
    },
  });

  const [input, setInput] = React.useState("");

  const {
    messages,
    sendMessage,
    setMessages,
    status,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent/chat",
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Load history into useChat when drawer opens and history is loaded
  useEffect(() => {
    if (history) {
      // Filter out tool messages as their results are rendered in the assistant message parts
      const filtered = history.filter((h) => h.role !== "tool");
      setMessages(
        filtered.map((h) => ({
          id: h.id,
          role: h.role as "user" | "assistant" | "system",
          parts: [
            {
              type: "text" as const,
              text: h.content,
            },
          ],
          createdAt: new Date(h.createdAt),
        }))
      );
    }
  }, [history, setMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  return (
    <aside className="w-96 shrink-0 border-l border-zinc-900 bg-zinc-950/70 backdrop-blur-xl flex flex-col h-screen animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-indigo-400 animate-pulse" size={18} />
          <h2 className="text-sm font-bold text-zinc-100">Gusion AI Assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => clearHistoryMutation.mutate()}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 p-6 text-zinc-500">
            <Sparkles size={24} className="text-zinc-700" />
            <p className="text-xs font-semibold">How can I help you today?</p>
            <p className="text-[11px] leading-normal max-w-50">
              &quot;Draft a reply to Sarah,&quot; &quot;Find events this week,&quot; or &quot;Schedule a sync meeting with guests.&quot;
            </p>
          </div>
        ) : (
          messages.map((message: UIMessage) => {
            const isUser = message.role === "user";
            // Extract text parts
            const textContent = message.parts
              ?.filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n") ?? "";

            return (
              <div
                key={message.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                {/* Bubble */}
                {textContent && (
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                      isUser
                        ? "bg-indigo-600 text-white rounded-br-none"
                        : "bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-bl-none"
                    }`}
                  >
                    {textContent}
                  </div>
                )}

                {/* Tool Invocations / Proposals */}
                {message.parts?.map((part) => {
                  if (part.type?.startsWith("tool-")) {
                    const toolInv = part as unknown as ToolInvPart;
                    const result = toolInv.output;
                    if (result?.status === "requires_confirmation") {
                      if (result.proposalType === "email") {
                        return (
                          <EmailProposalCard
                            key={toolInv.toolCallId}
                            data={result.data as EmailProposalData}
                          />
                        );
                      } else if (result.proposalType === "event") {
                        return (
                          <EventProposalCard
                            key={toolInv.toolCallId}
                            data={result.data as EventProposalData}
                          />
                        );
                      }
                    }
                  }
                  return null;
                })}
              </div>
            );
          })
        )}
        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 pl-2">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-150" />
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-300" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          void sendMessage({ text: input });
          setInput("");
        }}
        className="p-3 border-t border-zinc-900 bg-zinc-950 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Gusion to reply, schedule, search..."
          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-850 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
        >
          <Send size={14} />
        </button>
      </form>
    </aside>
  );
}

// ----------------------------------------------------
// Email Draft Confirmation Card
// ----------------------------------------------------
function EmailProposalCard({ data }: { data: EmailProposalData }) {
  const [status, setStatus] = React.useState<"pending" | "sent" | "dismissed">(
    "pending"
  );

  const sendEmailMutation = api.gmail.sendEmail.useMutation({
    onSuccess: () => {
      setStatus("sent");
      toast.success("Draft approved and sent successfully!");
    },
    onError: (err) => {
      toast.error(`Failed to send: ${err.message}`);
    },
  });

  const replyMutation = api.gmail.replyToEmail.useMutation({
    onSuccess: () => {
      setStatus("sent");
      toast.success("Reply sent successfully!");
    },
    onError: (err) => {
      toast.error(`Failed to reply: ${err.message}`);
    },
  });

  const handleApprove = () => {
    if (data.threadId && data.inReplyTo) {
      replyMutation.mutate({
        to: data.to,
        subject: data.subject,
        body: data.body,
        threadId: data.threadId,
        inReplyTo: data.inReplyTo,
        references: data.references,
      });
    } else {
      sendEmailMutation.mutate({
        to: data.to,
        subject: data.subject,
        body: data.body,
      });
    }
  };

  if (status === "dismissed") {
    return (
      <div className="mt-2 p-2 rounded-lg border border-zinc-850 bg-zinc-900/40 text-[10px] text-zinc-500 w-full max-w-[85%] text-left">
        Draft dismissed
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="mt-2 p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-left w-full max-w-[85%] flex items-center gap-2 text-xs text-emerald-400">
        <Check size={14} />
        <span>Email sent!</span>
      </div>
    );
  }

  const isReply = !!data.threadId;

  return (
    <div className="mt-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900 text-left w-full max-w-[85%] shadow-md space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
        <Mail size={12} className="text-indigo-400" />
        <span>{isReply ? "Proposed Reply" : "Proposed Email"}</span>
      </div>

      <div className="text-[11px] space-y-1 border-b border-zinc-800/60 pb-2">
        <div className="truncate text-zinc-300">
          <span className="text-zinc-500 font-medium">To: </span>
          {data.to}
        </div>
        <div className="truncate font-semibold text-zinc-200">
          <span className="text-zinc-500 font-medium">Subject: </span>
          {data.subject}
        </div>
      </div>

      <div className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
        {data.body}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={() => setStatus("dismissed")}
          className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
        >
          Dismiss
        </button>
        <button
          onClick={handleApprove}
          disabled={sendEmailMutation.isPending || replyMutation.isPending}
          className="px-3 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition cursor-pointer flex items-center gap-1"
        >
          <span>Approve & Send</span>
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Calendar Event Confirmation Card
// ----------------------------------------------------
function EventProposalCard({ data }: { data: EventProposalData }) {
  const [status, setStatus] = React.useState<"pending" | "created" | "dismissed">(
    "pending"
  );

  const inviteMutation = api.calendar.sendInvite.useMutation({
    onSuccess: () => {
      setStatus("created");
      toast.success("Event scheduled and invitations sent!");
    },
    onError: (err) => {
      toast.error(`Scheduling failed: ${err.message}`);
    },
  });

  const draftMutation = api.calendar.createDraft.useMutation({
    onSuccess: () => {
      setStatus("created");
      toast.success("Event draft created successfully!");
    },
    onError: (err) => {
      toast.error(`Failed to create draft: ${err.message}`);
    },
  });

  const handleApprove = () => {
    if (data.attendees && data.attendees.length > 0) {
      inviteMutation.mutate({
        summary: data.summary,
        description: data.description ?? "",
        location: data.location ?? "",
        start: new Date(data.start).toISOString(),
        end: new Date(data.end).toISOString(),
        attendees: data.attendees,
      });
    } else {
      draftMutation.mutate({
        summary: data.summary,
        description: data.description ?? "",
        location: data.location ?? "",
        start: new Date(data.start).toISOString(),
        end: new Date(data.end).toISOString(),
      });
    }
  };

  if (status === "dismissed") {
    return (
      <div className="mt-2 p-2 rounded-lg border border-zinc-850 bg-zinc-900/40 text-[10px] text-zinc-500 w-full max-w-[85%] text-left">
        Proposal dismissed
      </div>
    );
  }

  if (status === "created") {
    return (
      <div className="mt-2 p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-left w-full max-w-[85%] flex items-center gap-2 text-xs text-emerald-400">
        <Check size={14} />
        <span>Event scheduled!</span>
      </div>
    );
  }

  const startDate = new Date(data.start);
  const endDate = new Date(data.end);

  const formattedTime = `${startDate.toLocaleDateString()} @ ${startDate.toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" }
  )} - ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="mt-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900 text-left w-full max-w-[85%] shadow-md space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
        <CalendarIcon size={12} className="text-indigo-400" />
        <span>Proposed Schedule</span>
      </div>

      <div className="font-bold text-zinc-100 text-xs">{data.summary}</div>

      <div className="space-y-1.5 text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-zinc-650" />
          <span>{formattedTime}</span>
        </div>
        {data.location && (
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="text-zinc-650" />
            <span>{data.location}</span>
          </div>
        )}
        {data.attendees && data.attendees.length > 0 && (
          <div className="flex items-start gap-1.5">
            <Users size={11} className="text-zinc-650 mt-0.5" />
            <span className="truncate">{data.attendees.join(", ")}</span>
          </div>
        )}
      </div>

      {data.description && (
        <div className="text-[10px] text-zinc-400 border-t border-zinc-850 pt-1.5 whitespace-pre-wrap">
          {data.description}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={() => setStatus("dismissed")}
          className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
        >
          Dismiss
        </button>
        <button
          onClick={handleApprove}
          disabled={inviteMutation.isPending || draftMutation.isPending}
          className="px-3 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition cursor-pointer flex items-center gap-1"
        >
          <span>Confirm Invite</span>
        </button>
      </div>
    </div>
  );
}
