"use client";

import React, { useEffect, useRef, useState } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { api } from "@/trpc/react";
import {
  Sparkles,
  Send,
  Trash2,
  Mail,
  Calendar,
  Check,
  Clock,
  MapPin,
  Users,
  Search,
  PenLine,
  Star,
  Zap,
  AtSign,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  { label: "Daily briefing", icon: Sparkles, prompt: "Give me a daily briefing of my emails and upcoming events today." },
  { label: "Priority emails", icon: Star, prompt: "Which emails need my immediate attention right now?" },
  { label: "Compose email", icon: PenLine, prompt: "Help me compose a new email. Ask me who to send it to and what to say." },
  { label: "Schedule meeting", icon: Calendar, prompt: "Help me schedule a meeting. Ask me for the details." },
  { label: "Search inbox", icon: Search, prompt: "Search my emails for " },
  { label: "Quick reply", icon: Zap, prompt: "Draft a quick reply to the most recent email in my inbox." },
];

interface CommandCenterProps {
  onNavigate: (tab: "gmail" | "calendar" | "settings" | "tickets" | "bulk" | "inbox") => void;
}

export function CommandCenter({ onNavigate }: CommandCenterProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyLoadedRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: history } = api.agent.getHistory.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const { data: contactsData } = api.contacts.listContacts.useQuery(
    { limit: 50 },
    { staleTime: 60000 }
  );

  const { data: templates } = api.template.listTemplates.useQuery(undefined, {
    staleTime: 60000,
  });

  const clearHistoryMutation = api.agent.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([]);
      historyLoadedRef.current = false;
      toast.success("Chat history cleared");
    },
  });

  const [input, setInput] = useState("");
  const [mentionQuery, setMentionQuery] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent/chat" }),
  });

  const isLoading = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (history && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      const filtered = history.filter((h) => h.role !== "tool");
      setMessages(
        filtered.map((h) => ({
          id: h.id,
          role: h.role as "user" | "assistant" | "system",
          parts: [{ type: "text" as const, text: h.content }],
          createdAt: new Date(h.createdAt),
        }))
      );
    }
  }, [history, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset highlighted index when dropdown opens or query changes
  useEffect(() => {
    setHighlightedIdx(0);
  }, [showMentionDropdown, showTemplateDropdown, mentionQuery, templateQuery]);

  const filteredContacts = (contactsData ?? []).filter((c) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  }).slice(0, 8);

  const filteredTemplates = (templates ?? []).filter((t) => {
    if (!templateQuery) return true;
    const q = templateQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.shortcut?.toLowerCase().includes(q);
  }).slice(0, 6);

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return;
    void sendMessage({ text });
    setInput("");
    setShowMentionDropdown(false);
    setShowTemplateDropdown(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Detect @mention
    const atMatch = /@([^@\s]*)$/.exec(textBeforeCursor);
    // Detect /template (only if not inside an @)
    const slashMatch = !atMatch ? /\/([^\s]*)$/.exec(textBeforeCursor) : null;

    if (atMatch) {
      setMentionQuery(atMatch[1] ?? "");
      setShowMentionDropdown(true);
      setShowTemplateDropdown(false);
    } else if (slashMatch) {
      setTemplateQuery(slashMatch[1] ?? "");
      setShowTemplateDropdown(true);
      setShowMentionDropdown(false);
    } else {
      setShowMentionDropdown(false);
      setShowTemplateDropdown(false);
    }
  };

  const insertContact = (contact: { name: string | null; email: string }) => {
    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const atMatch = /@([^@\s]*)$/.exec(textBeforeCursor);
    if (!atMatch) return;
    const label = contact.name ? `${contact.name} <${contact.email}>` : contact.email;
    const before = input.slice(0, cursorPos - atMatch[0].length);
    const after = input.slice(cursorPos);
    setInput(before + label + " " + after);
    setShowMentionDropdown(false);
    setMentionQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const insertTemplate = (tpl: { body: string }) => {
    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const slashMatch = /\/([^\s]*)$/.exec(textBeforeCursor);
    const before = slashMatch ? input.slice(0, cursorPos - slashMatch[0].length) : input.slice(0, cursorPos);
    const after = input.slice(cursorPos);
    setInput(before + tpl.body + after);
    setShowTemplateDropdown(false);
    setTemplateQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const dropdownOpen = showMentionDropdown || showTemplateDropdown;
    const items = showMentionDropdown ? filteredContacts : filteredTemplates;

    if (dropdownOpen && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = items[highlightedIdx];
        if (item) {
          if (showMentionDropdown) {
            insertContact(item as { name: string | null; email: string });
          } else {
            insertTemplate(item as { body: string });
          }
        }
        return;
      }
      if (e.key === "Escape") {
        setShowMentionDropdown(false);
        setShowTemplateDropdown(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3.5 border-b border-zinc-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
            <Sparkles size={14} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 leading-none">Gusion AI</h2>
            <p className="text-[10px] text-zinc-600 mt-0.5">your email command center</p>
          </div>
        </div>
        {hasMessages && (
          <button
            onClick={() => clearHistoryMutation.mutate()}
            className="p-1.5 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 rounded-lg transition cursor-pointer"
            title="Clear conversation"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-5 pb-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Sparkles size={28} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-200">What would you like to do?</p>
              <p className="text-xs text-zinc-600 mt-1.5 max-w-xs leading-relaxed">
                I can draft emails, search your inbox, schedule meetings, summarize threads, and more.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition cursor-pointer text-left"
                >
                  <action.icon size={13} className="text-indigo-400 shrink-0" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message: UIMessage) => {
          const isUser = message.role === "user";
          const textContent =
            message.parts
              ?.filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n") ?? "";

          return (
            <div key={message.id} className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
              {textContent && (
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-zinc-900 text-zinc-200 border border-zinc-800/60 rounded-bl-sm"
                  }`}
                >
                  {textContent}
                </div>
              )}

              {message.parts?.map((part) => {
                if (part.type?.startsWith("tool-")) {
                  const toolInv = part as unknown as {
                    type: string;
                    toolCallId: string;
                    output?: { status: string; proposalType: string; data: unknown };
                  };
                  const result = toolInv.output;
                  if (result?.status === "requires_confirmation") {
                    if (result.proposalType === "email") {
                      return <EmailProposalCard key={toolInv.toolCallId} data={result.data as EmailProposalData} />;
                    } else if (result.proposalType === "event") {
                      return <EventProposalCard key={toolInv.toolCallId} data={result.data as EventProposalData} />;
                    }
                  }
                }
                return null;
              })}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={11} className="text-indigo-400" />
            </div>
            <div className="flex items-center gap-1 py-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick action chips */}
      {hasMessages && (
        <div className="px-6 pb-2 flex gap-1.5 flex-wrap shrink-0">
          {QUICK_ACTIONS.slice(0, 4).map((action) => (
            <button
              key={action.label}
              onClick={() => handleSend(action.prompt)}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 rounded-full transition cursor-pointer"
            >
              <action.icon size={9} />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="px-6 pb-5 pt-2 shrink-0 border-t border-zinc-900">
        <div className="relative">
          {/* @ Contact dropdown */}
          {showMentionDropdown && filteredContacts.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full mb-1 left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50"
            >
              <div className="px-3 py-1.5 border-b border-zinc-800">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Contacts</span>
              </div>
              {filteredContacts.map((contact, idx) => (
                <button
                  key={contact.email}
                  onMouseDown={(e) => { e.preventDefault(); insertContact(contact); }}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 transition cursor-pointer ${
                    idx === highlightedIdx ? "bg-indigo-600/15 text-zinc-100" : "hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-400 shrink-0">
                    {(contact.name ?? contact.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {contact.name && <div className="text-xs font-medium truncate">{contact.name}</div>}
                    <div className="text-[10px] text-zinc-500 truncate">{contact.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* / Template dropdown */}
          {showTemplateDropdown && filteredTemplates.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full mb-1 left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50"
            >
              <div className="px-3 py-1.5 border-b border-zinc-800">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Templates</span>
              </div>
              {filteredTemplates.map((tpl, idx) => (
                <button
                  key={tpl.id}
                  onMouseDown={(e) => { e.preventDefault(); insertTemplate(tpl); }}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 transition cursor-pointer ${
                    idx === highlightedIdx ? "bg-indigo-600/15 text-zinc-100" : "hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <FileText size={12} className="text-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{tpl.name}</div>
                    {tpl.shortcut && <div className="text-[10px] text-zinc-500">/{tpl.shortcut}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-800 rounded-2xl focus-within:border-indigo-500/60 transition-colors overflow-hidden shadow-sm">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to reply to emails, schedule meetings, search your inbox..."
              rows={3}
              className="w-full px-4 pt-3.5 pb-2 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">
              <div className="flex gap-1">
                <button
                  onClick={() => handleSend("Help me compose a new email")}
                  className="px-2.5 py-1.5 text-[10px] font-medium text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Compose email"
                >
                  <PenLine size={10} /> Compose
                </button>
                <button
                  onClick={() => handleSend("Help me schedule a meeting")}
                  className="px-2.5 py-1.5 text-[10px] font-medium text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Schedule meeting"
                >
                  <Calendar size={10} /> Schedule
                </button>
                <button
                  onClick={() => {
                    const atPos = input.length;
                    setInput(input + "@");
                    setShowMentionDropdown(true);
                    setMentionQuery("");
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.setSelectionRange(atPos + 1, atPos + 1);
                      }
                    }, 10);
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-medium text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Mention a contact"
                >
                  <AtSign size={10} /> Contact
                </button>
                <button
                  onClick={() => {
                    const slashPos = input.length;
                    setInput(input + "/");
                    setShowTemplateDropdown(true);
                    setTemplateQuery("");
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.setSelectionRange(slashPos + 1, slashPos + 1);
                      }
                    }, 10);
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-medium text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Insert template"
                >
                  <FileText size={10} /> Template
                </button>
              </div>
              <button
                onClick={() => handleSend(input)}
                disabled={isLoading || !input.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-zinc-700 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line · <span className="text-zinc-600">@ contacts · / templates</span>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposal Cards
// ---------------------------------------------------------------------------

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

function EmailProposalCard({ data }: { data: EmailProposalData }) {
  const [status, setStatus] = React.useState<"pending" | "sent" | "dismissed">("pending");

  const sendEmailMutation = api.gmail.sendEmail.useMutation({
    onSuccess: () => { setStatus("sent"); toast.success("Email sent!"); },
    onError: (err) => toast.error(`Failed to send: ${err.message}`),
  });

  const replyMutation = api.gmail.replyToEmail.useMutation({
    onSuccess: () => { setStatus("sent"); toast.success("Reply sent!"); },
    onError: (err) => toast.error(`Failed to reply: ${err.message}`),
  });

  const handleApprove = () => {
    if (data.threadId && data.inReplyTo) {
      replyMutation.mutate({ to: data.to, subject: data.subject, body: data.body, threadId: data.threadId, inReplyTo: data.inReplyTo, references: data.references });
    } else {
      sendEmailMutation.mutate({ to: data.to, subject: data.subject, body: data.body });
    }
  };

  if (status === "dismissed") return (
    <div className="mt-1 p-2 rounded-lg border border-zinc-850 bg-zinc-900/40 text-[10px] text-zinc-500 w-full max-w-[80%]">Draft dismissed</div>
  );

  if (status === "sent") return (
    <div className="mt-1 p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 w-full max-w-[80%] flex items-center gap-2 text-xs text-emerald-400">
      <Check size={14} /> Email sent!
    </div>
  );

  return (
    <div className="mt-1 p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 w-full max-w-[80%] shadow-sm space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
        <Mail size={12} className="text-indigo-400" />
        {data.threadId ? "Proposed Reply" : "Proposed Email"}
      </div>
      <div className="text-[11px] space-y-0.5 border-b border-zinc-800/50 pb-2">
        <div className="truncate text-zinc-300"><span className="text-zinc-500">To: </span>{data.to}</div>
        <div className="truncate font-semibold text-zinc-200"><span className="text-zinc-500 font-normal">Subject: </span>{data.subject}</div>
      </div>
      <div className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">{data.body}</div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => setStatus("dismissed")} className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 transition cursor-pointer">
          Dismiss
        </button>
        <button
          onClick={handleApprove}
          disabled={sendEmailMutation.isPending || replyMutation.isPending}
          className="px-3 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
        >
          Approve & Send
        </button>
      </div>
    </div>
  );
}

function EventProposalCard({ data }: { data: EventProposalData }) {
  const [status, setStatus] = React.useState<"pending" | "created" | "dismissed">("pending");

  const inviteMutation = api.calendar.sendInvite.useMutation({
    onSuccess: () => { setStatus("created"); toast.success("Event scheduled!"); },
    onError: (err) => toast.error(`Scheduling failed: ${err.message}`),
  });

  const draftMutation = api.calendar.createDraft.useMutation({
    onSuccess: () => { setStatus("created"); toast.success("Event draft created!"); },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const handleApprove = () => {
    if (data.attendees && data.attendees.length > 0) {
      inviteMutation.mutate({ summary: data.summary, description: data.description ?? "", location: data.location ?? "", start: new Date(data.start).toISOString(), end: new Date(data.end).toISOString(), attendees: data.attendees });
    } else {
      draftMutation.mutate({ summary: data.summary, description: data.description ?? "", location: data.location ?? "", start: new Date(data.start).toISOString(), end: new Date(data.end).toISOString() });
    }
  };

  if (status === "dismissed") return (
    <div className="mt-1 p-2 rounded-lg border border-zinc-850 bg-zinc-900/40 text-[10px] text-zinc-500 w-full max-w-[80%]">Proposal dismissed</div>
  );

  if (status === "created") return (
    <div className="mt-1 p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 w-full max-w-[80%] flex items-center gap-2 text-xs text-emerald-400">
      <Check size={14} /> Event scheduled!
    </div>
  );

  const startDate = new Date(data.start);
  const endDate = new Date(data.end);
  const formattedTime = `${startDate.toLocaleDateString([], { month: "short", day: "numeric" })} @ ${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="mt-1 p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 w-full max-w-[80%] shadow-sm space-y-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
        <Calendar size={12} className="text-indigo-400" /> Proposed Schedule
      </div>
      <div className="font-bold text-zinc-100 text-sm">{data.summary}</div>
      <div className="space-y-1 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5"><Clock size={11} /> {formattedTime}</div>
        {data.location && <div className="flex items-center gap-1.5"><MapPin size={11} /> {data.location}</div>}
        {data.attendees && data.attendees.length > 0 && (
          <div className="flex items-start gap-1.5"><Users size={11} className="mt-0.5" /> {data.attendees.join(", ")}</div>
        )}
      </div>
      {data.description && (
        <div className="text-[10px] text-zinc-400 border-t border-zinc-800/50 pt-1.5 whitespace-pre-wrap">{data.description}</div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => setStatus("dismissed")} className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 transition cursor-pointer">
          Dismiss
        </button>
        <button
          onClick={handleApprove}
          disabled={inviteMutation.isPending || draftMutation.isPending}
          className="px-3 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
        >
          Approve & Schedule
        </button>
      </div>
    </div>
  );
}
