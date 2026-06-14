import { useState, useMemo, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import { useShortcuts } from "@/app/_hooks/use-shortcuts";
import { CommandPalette } from "@/app/_components/command-palette";
import { AgentDrawer } from "@/app/_components/agent-drawer";
import {
  formatMessageDate,
  formatSender,
  formatEventWhen,
  formatAttendees,
  parseEmailAddress,
} from "@/lib/display";
import {
  Mail,
  Calendar as CalendarIcon,
  LogOut,
  RefreshCw,
  Send,
  Search,
  Archive,
  Plus,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Clock,
  X,
  Trash2,
  Sparkles,
  Settings,
  Copy,
  Download,
  ExternalLink,
  Lock,
} from "lucide-react";



export function Dashboard() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<"gmail" | "calendar" | "settings">("gmail");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  // Compose state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Reply inline state
  const [replyBody, setReplyBody] = useState("");

  // Calendar week state
  const [weekOffset, setWeekOffset] = useState(0);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [eventSummary, setEventSummary] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventLoc, setEventLoc] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventAttendees, setEventAttendees] = useState("");

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Realtime updates subscription via SSE
  useEffect(() => {
    const eventSource = new EventSource("/api/realtime");

    eventSource.onmessage = (event) => {
      if (event.data === "connected" || event.data === "ping") {
        return;
      }
      try {
        const rawData = typeof event.data === "string" ? event.data : "";
        const parsed = JSON.parse(rawData) as Record<string, unknown>;
        const eventType = typeof parsed.type === "string" ? parsed.type : "";
        const eventMsg = typeof parsed.message === "string" ? parsed.message : "Update received";

        if (eventType === "inbox_update") {
          void utils.gmail.searchEmails.invalidate();
          toast.info(eventMsg);
        } else if (eventType === "calendar_update") {
          void utils.calendar.searchEvents.invalidate();
          toast.info(eventMsg);
        }
      } catch (err) {
        console.error("Failed to parse realtime event:", err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [utils]);

  // Fetch user details for trial check
  const { data: userProfile } = api.auth.me.useQuery(undefined, {
    staleTime: 60000,
  });

  const trialDaysRemaining = useMemo(() => {
    if (!userProfile?.trialStartedAt) return 14;
    const started = new Date(userProfile.trialStartedAt).getTime();
    const elapsed = Date.now() - started;
    const days = 14 - Math.floor(elapsed / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  }, [userProfile]);

  // Gmail queries/mutations
  const { data: emails, isLoading: emailsLoading } = api.gmail.searchEmails.useQuery(
    { query: debouncedSearch, limit: 30 },
    { enabled: activeTab === "gmail" }
  );

  const { data: selectedMessage, isLoading: messageLoading } = api.gmail.getMessage.useQuery(
    { id: activeMessageId ?? "" },
    { enabled: !!activeMessageId }
  );

  const refreshInbox = api.gmail.refreshInbox.useMutation({
    onSuccess: (res) => {
      toast.success(`Synced ${res.synced} threads.`);
      void utils.gmail.searchEmails.invalidate();
    },
    onError: () => toast.error("Sync failed."),
  });

  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent!");
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to send."),
  });

  const replyToEmail = api.gmail.replyToEmail.useMutation({
    onSuccess: () => {
      toast.success("Reply sent!");
      setReplyBody("");
      void utils.gmail.searchEmails.invalidate();
      if (activeMessageId) {
        void utils.gmail.getMessage.invalidate({ id: activeMessageId });
      }
    },
    onError: (err) => toast.error(err.message || "Failed to send reply."),
  });

  const archiveEmail = api.gmail.archiveEmail.useMutation({
    onMutate: async ({ id }) => {
      // Optimistic update
      toast.info("Archived message", {
        action: {
          label: "Undo",
          onClick: () => toast.info("Undo Send not supported in preview"),
        },
      });
      if (activeMessageId === id) {
        setActiveMessageId(null);
      }
    },
    onSuccess: () => {
      void utils.gmail.searchEmails.invalidate();
    },
  });

  const markRead = api.gmail.markRead.useMutation({
    onSuccess: () => {
      void utils.gmail.searchEmails.invalidate();
      if (activeMessageId) {
        void utils.gmail.getMessage.invalidate({ id: activeMessageId });
      }
    },
  });

  // Calendar queries/mutations
  const weekRange = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + weekOffset * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }, [weekOffset]);

  const { data: events, isLoading: eventsLoading } = api.calendar.searchEvents.useQuery(
    {
      query: debouncedSearch,
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
    },
    { enabled: activeTab === "calendar" }
  );

  const refreshEvents = api.calendar.refreshEvents.useMutation({
    onSuccess: (res) => {
      toast.success(`Synced ${res.synced} events.`);
      void utils.calendar.searchEvents.invalidate();
    },
    onError: () => toast.error("Sync failed."),
  });

  const sendInvite = api.calendar.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Calendar invite sent!");
      setCreateEventOpen(false);
      setEventSummary("");
      setEventDesc("");
      setEventLoc("");
      setEventStart("");
      setEventEnd("");
      setEventAttendees("");
      void utils.calendar.searchEvents.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to create event."),
  });

  const deleteEvent = api.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      toast.success("Event deleted.");
      void utils.calendar.searchEvents.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete event."),
  });

  // Keyboard Navigation Focus State
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    setFocusedIndex(0);
  }, [emails, activeTab]);

  // Keyboard Shortcuts bindings
  useShortcuts({
    j: () => {
      if (activeTab === "gmail" && emails && focusedIndex < emails.length - 1) {
        setFocusedIndex((prev) => prev + 1);
      }
    },
    k: () => {
      if (activeTab === "gmail" && focusedIndex > 0) {
        setFocusedIndex((prev) => prev - 1);
      }
    },
    Enter: () => {
      if (activeTab === "gmail" && emails?.[focusedIndex]) {
        setActiveMessageId(emails[focusedIndex].id);
        // Mark as read
        markRead.mutate({ id: emails[focusedIndex].id, read: true });
      }
    },
    e: () => {
      if (activeTab === "gmail" && emails?.[focusedIndex]) {
        archiveEmail.mutate({ id: emails[focusedIndex].id });
      }
    },
    u: () => {
      if (activeTab === "gmail" && emails?.[focusedIndex]) {
        // Toggle read/unread (since we don't have current read state readily in list, we toggle)
        markRead.mutate({ id: emails[focusedIndex].id, read: false });
        toast.info("Marked as unread");
      }
    },
    c: (e) => {
      e.preventDefault();
      setComposeOpen(true);
    },
    r: (e) => {
      e.preventDefault();
      if (selectedMessage) {
        const replyInput = document.getElementById("reply-input");
        if (replyInput) replyInput.focus();
      }
    },
    Escape: () => {
      setActiveMessageId(null);
      setComposeOpen(false);
      setCreateEventOpen(false);
      setShortcutHelpOpen(false);
      setAgentOpen(false);
    },
    "g i": () => setActiveTab("gmail"),
    "g c": () => setActiveTab("calendar"),
    "g s": () => setActiveTab("settings"),
    "?": () => setShortcutHelpOpen((prev) => !prev),
    "Cmd+K": (e) => {
      e.preventDefault();
      setCommandPaletteOpen((prev) => !prev);
    },
    "Cmd+I": (e) => {
      e.preventDefault();
      setAgentOpen((prev) => !prev);
    },
  });

  const handleCommandAction = (action: string, payload?: string) => {
    switch (action) {
      case "search":
        if (payload) {
          setActiveTab("gmail");
          setSearchQuery(payload);
        }
        break;
      case "inbox":
        setActiveTab("gmail");
        break;
      case "calendar":
        setActiveTab("calendar");
        break;
      case "settings":
        setActiveTab("settings");
        break;
      case "agent":
        setAgentOpen(true);
        break;
      case "compose":
        setComposeOpen(true);
        break;
      case "archive":
        if (emails?.[focusedIndex]) {
          archiveEmail.mutate({ id: emails[focusedIndex].id });
        }
        break;
      case "mark-read":
        if (emails?.[focusedIndex]) {
          markRead.mutate({ id: emails[focusedIndex].id, read: true });
        }
        break;
      case "help":
        setShortcutHelpOpen(true);
        break;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      {/* 1st Pane: Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-zinc-900 bg-zinc-900/10 flex flex-col justify-between p-4">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg">
              G
            </div>
            <span className="font-bold text-md tracking-tight text-zinc-100">Gusion Mail</span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("gmail")}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                activeTab === "gmail"
                  ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Mail size={16} />
              <span>Emails</span>
            </button>
            <button
              onClick={() => setActiveTab("calendar")}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                activeTab === "calendar"
                  ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <CalendarIcon size={16} />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => {
                setAgentOpen(!agentOpen);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                agentOpen
                  ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Sparkles size={16} />
              <span>AI Agent</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("settings");
                setAgentOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                activeTab === "settings"
                  ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Footer info: Trial and Sign Out */}
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-indigo-500/10 bg-indigo-500/5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-1">
              <Clock size={12} />
              <span>Trial Active</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {trialDaysRemaining} days remaining in trial. Accessing all Pro features.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-900 pt-4 px-2">
            <div className="flex items-center gap-2 min-w-0">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  className="w-7 h-7 rounded-full border border-zinc-800"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">
                  {session?.user?.name?.[0]}
                </div>
              )}
              <span className="text-xs font-medium text-zinc-300 truncate">{session?.user?.name}</span>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main workspace (tabs) */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "gmail" && (
          <>
            {/* 2nd Pane: Email List */}
            <section className="w-[420px] flex-shrink-0 border-r border-zinc-900 flex flex-col bg-zinc-900/5">
              {/* Header search / action */}
              <div className="p-4 border-b border-zinc-900 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-md font-semibold text-zinc-200">Inbox</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => refreshInbox.mutate()}
                      disabled={refreshInbox.isPending}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                      title="Sync Inbox"
                    >
                      <RefreshCw size={14} className={refreshInbox.isPending ? "animate-spin" : ""} />
                    </button>
                    <button
                      onClick={() => setComposeOpen(true)}
                      className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={12} />
                      <span>Compose</span>
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search mail (e.g. subject, body)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Emails List */}
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/50">
                {emailsLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
                    <LoaderIcon />
                    <span className="text-xs">Loading inbox...</span>
                  </div>
                ) : !emails || emails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
                    <span className="text-xs">No emails found</span>
                  </div>
                ) : (
                  emails.map((email, idx) => (
                    <div
                      key={email.id}
                      onClick={() => {
                        setFocusedIndex(idx);
                        setActiveMessageId(email.id);
                        markRead.mutate({ id: email.id, read: true });
                      }}
                      className={`p-4 cursor-pointer text-left transition ${
                        focusedIndex === idx
                          ? "bg-indigo-500/5 border-l-2 border-indigo-500"
                          : idx % 2 === 0
                          ? "bg-zinc-900/5"
                          : "bg-transparent"
                      } hover:bg-zinc-900/20`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="text-xs font-semibold text-zinc-300 truncate max-w-[200px]">
                          {parseEmailAddress(email.from).name || parseEmailAddress(email.from).email}
                        </span>
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                          {formatMessageDate(email.date)}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-200 truncate mb-1">
                        {email.subject || "(No Subject)"}
                      </h4>
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {email.snippet}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 3rd Pane: Reading Pane */}
            <section className="flex-1 flex flex-col bg-zinc-950">
              {messageLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
                  <LoaderIcon />
                  <span className="text-xs">Opening thread...</span>
                </div>
              ) : !selectedMessage ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-center p-8">
                  <div className="w-12 h-12 rounded-full border border-zinc-900 bg-zinc-900/20 flex items-center justify-center mb-4">
                    <Mail size={20} />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-1">No thread selected</h3>
                  <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                    Select an email from the inbox list or press <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">Enter</kbd> to read a conversation.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Reading Pane Header */}
                  <div className="p-6 border-b border-zinc-900 flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-white mb-2 leading-snug">
                        {selectedMessage.subject || "(No Subject)"}
                      </h2>
                      <div className="text-xs space-y-1">
                        <div className="text-zinc-400">
                          <span className="font-medium text-zinc-500">From: </span>
                          {formatSender(selectedMessage.from)}
                        </div>
                        <div className="text-zinc-400">
                          <span className="font-medium text-zinc-500">To: </span>
                          {formatSender(selectedMessage.to)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => archiveEmail.mutate({ id: selectedMessage.id })}
                        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer"
                        title="Archive Email (e)"
                      >
                        <Archive size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Reading Pane Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    <div className="prose prose-invert max-w-none text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(selectedMessage.body),
                        }}
                      />
                    </div>

                    {/* Inline Reply Form */}
                    <div className="pt-6 border-t border-zinc-900">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Quick Reply</h4>
                      <div className="space-y-3">
                        <textarea
                          id="reply-input"
                          placeholder="Write your reply here..."
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          rows={4}
                          className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition resize-none"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              const parentIdMatch = /Message-ID:\s*<([^>]+)>/i.exec(selectedMessage.body);
                              const inReplyTo = parentIdMatch ? `<${parentIdMatch[1]!}>` : `<parent_message_id_placeholder>`;
                              replyToEmail.mutate({
                                to: parseEmailAddress(selectedMessage.from).email,
                                subject: selectedMessage.subject,
                                body: replyBody,
                                threadId: selectedMessage.threadId,
                                inReplyTo,
                              });
                            }}
                            disabled={!replyBody.trim() || replyToEmail.isPending}
                            className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span>Send Reply</span>
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "calendar" && (
          /* Calendar Main View */
          <section className="flex-1 flex flex-col bg-zinc-950">
            {/* Calendar Header */}
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-white">Calendar Schedule</h2>
                <div className="flex items-center gap-1 border border-zinc-800 rounded-lg p-0.5 bg-zinc-900/30">
                  <button
                    onClick={() => setWeekOffset((prev) => prev - 1)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setWeekOffset(0)}
                    className="px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition cursor-pointer font-medium"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setWeekOffset((prev) => prev + 1)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refreshEvents.mutate({ weekStart: weekRange.start, weekEnd: weekRange.end })}
                  disabled={refreshEvents.isPending}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                  title="Sync Events"
                >
                  <RefreshCw size={14} className={refreshEvents.isPending ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setCreateEventOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>Create Event</span>
                </button>
              </div>
            </div>

            {/* Events view list / grid */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {eventsLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-2">
                  <LoaderIcon />
                  <span className="text-xs">Loading schedule...</span>
                </div>
              ) : !events || events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-center">
                  <h3 className="text-sm font-semibold text-zinc-400 mb-1">No events scheduled</h3>
                  <p className="text-xs text-zinc-500">You are free this week!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-5 rounded-xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-sm relative group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="text-sm font-bold text-zinc-100 truncate">{event.summary || "(No Title)"}</h4>
                          <button
                            onClick={() => deleteEvent.mutate({ id: event.id })}
                            className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="Delete Event"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <p className="text-xs text-indigo-400 font-medium mb-3">
                          {formatEventWhen(event.start, event.end)}
                        </p>
                        {event.location && (
                          <p className="text-[11px] text-zinc-400 mb-2 truncate">
                            <span className="font-semibold text-zinc-500">Location:</span> {event.location}
                          </p>
                        )}
                        {event.description && (
                          <p className="text-[11px] text-zinc-500 line-clamp-3 leading-relaxed mb-3">
                            {event.description}
                          </p>
                        )}
                      </div>
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="text-[10px] text-zinc-400 border-t border-zinc-900 pt-3 mt-3">
                          <span className="font-semibold text-zinc-500">Attendees:</span>{" "}
                          {formatAttendees(event.attendees)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "settings" && <SettingsView />}
      </div>

      {/* Floating help / keyboard overlay trigger */}
      <button
        onClick={() => setShortcutHelpOpen(true)}
        className="fixed bottom-4 right-4 p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded-full transition shadow-lg cursor-pointer"
        title="Keyboard Shortcuts"
      >
        <HelpCircle size={18} />
      </button>

      {/* Help Modal */}
      {shortcutHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl relative">
            <button
              onClick={() => setShortcutHelpOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
            >
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-white mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Move list focus down</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">j</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Move list focus up</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">k</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Open conversation</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">Enter</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Archive focused thread</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">e</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Mark thread as unread</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">u</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Compose new email</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">c</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Focus inline reply input</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">r</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Go to Inbox</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">g i</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Go to Calendar</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">g c</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Open Command Palette</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">⌘ K</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose Email Modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl relative space-y-4">
            <button
              onClick={() => setComposeOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
            >
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-white">New Message</h3>
            <div className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">To</label>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Message</label>
                <textarea
                  placeholder="Write your email body..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={8}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setComposeOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => sendEmail.mutate({ to: composeTo, subject: composeSubject, body: composeBody })}
                disabled={!composeTo || !composeSubject || !composeBody || sendEmail.isPending}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
              >
                <span>Send</span>
                <Send size={10} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {createEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl relative space-y-4">
            <button
              onClick={() => setCreateEventOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
            >
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-white">Create Calendar Event</h3>
            <div className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Event Title</label>
                <input
                  type="text"
                  placeholder="Team sync meeting"
                  value={eventSummary}
                  onChange={(e) => setEventSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Location</label>
                <input
                  type="text"
                  placeholder="Google Meet or office address"
                  value={eventLoc}
                  onChange={(e) => setEventLoc(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Attendees (comma separated emails)</label>
                <input
                  type="text"
                  placeholder="guest1@example.com, guest2@example.com"
                  value={eventAttendees}
                  onChange={(e) => setEventAttendees(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Description</label>
                <textarea
                  placeholder="Agenda points or description..."
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  rows={4}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCreateEventOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const attendeesList = eventAttendees
                    .split(",")
                    .map((item) => item.trim())
                    .filter((item) => item.includes("@"));

                  sendInvite.mutate({
                    summary: eventSummary,
                    description: eventDesc,
                    location: eventLoc,
                    start: new Date(eventStart).toISOString(),
                    end: new Date(eventEnd).toISOString(),
                    attendees: attendeesList,
                  });
                }}
                disabled={!eventSummary || !eventStart || !eventEnd || sendInvite.isPending}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
              >
                <span>Create & Invite</span>
                <Send size={10} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        setOpen={setCommandPaletteOpen}
        onAction={handleCommandAction}
      />

      {/* AI Agent Drawer */}
      <AgentDrawer
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
      />
    </div>
  );
}

function SettingsView() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [inviteEmail, setInviteEmail] = useState("");
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);

  // Queries
  const { data: sub } = api.billing.getSubscription.useQuery();
  const { data: refStats, refetch: refetchRefStats } = api.referral.getReferralStats.useQuery();
  const { data: userProfile } = api.auth.me.useQuery();

  // Prefill referral code if present in localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && !refStats?.referredByCode) {
      const stored = localStorage.getItem("gusion_referral_code");
      if (stored) {
        setReferralCodeInput(stored);
      }
    }
  }, [refStats]);

  // Mutations
  const updateSettings = api.auth.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings updated successfully!");
      void utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update settings.");
    },
  });

  const submitInvite = api.referral.submitReferral.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent successfully!");
      setInviteEmail("");
      void refetchRefStats();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send invitation.");
    },
  });

  const applyCode = api.referral.applyReferralCode.useMutation({
    onSuccess: () => {
      toast.success("Referral code applied! 30 days added to your trial.");
      setReferralCodeInput("");
      void refetchRefStats();
      void utils.billing.getSubscription.invalidate();
      void utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to apply referral code.");
    },
  });

  const checkoutSession = api.billing.createCheckoutSession.useMutation({
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
    onError: (err) => {
      toast.error(err.message || "Failed to initiate checkout.");
    },
  });

  const portalSession = api.billing.createPortalSession.useMutation({
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
    onError: (err) => {
      toast.error(err.message || "Failed to open billing portal.");
    },
  });

  const deleteAccount = api.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted successfully.");
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete account.");
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await utils.auth.exportData.fetch();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gusion-mail-export-${session?.user?.id ?? "data"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully!");
    } catch {
      toast.error("Failed to export data.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyCode = () => {
    if (refStats?.referralCode) {
      void navigator.clipboard.writeText(refStats.referralCode);
      toast.success("Referral code copied to clipboard!");
    }
  };

  const handleCopyLink = () => {
    if (refStats?.referralCode) {
      const link = `${window.location.origin}/?ref=${refStats.referralCode}`;
      void navigator.clipboard.writeText(link);
      toast.success("Referral link copied to clipboard!");
    }
  };

  const isSubscribed = sub?.plan && sub.plan !== "free" && sub.status === "active";

  return (
    <section className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Settings & Account Control</h2>
        <p className="text-zinc-500 text-xs">Manage subscriptions, referrals, security compliance, and privacy controls.</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Left column: Growth & Referrals */}
        <div className="space-y-8">
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              Refer & Earn Extensions
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              Invite friends to try Gusion Mail. When they sign up, both of you will receive an extra <span className="text-indigo-400 font-semibold">30 days</span> on your free trial!
            </p>

            {/* Referral code display */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Your Code</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-sm font-bold text-white tracking-wider">{refStats?.referralCode ?? "..."}</span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Copy Code"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Share Link</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-zinc-400 truncate max-w-[80px]">gusion-mail.com/?ref=...</span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1 hover:bg-zinc-900 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                    title="Copy Link"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Input to send invite */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Invite a Friend by Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => submitInvite.mutate({ email: inviteEmail })}
                    disabled={!inviteEmail || submitInvite.isPending}
                    className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    Send Invite
                  </button>
                </div>
              </div>

              {/* Input to apply a referral code */}
              {!refStats?.referredByCode ? (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Were you referred? Enter Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ENTER-FRIENDS-CODE"
                      value={referralCodeInput}
                      onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                      className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-sm text-zinc-200 font-mono tracking-wider focus:outline-none focus:border-indigo-500 transition focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => applyCode.mutate({ code: referralCodeInput })}
                      disabled={!referralCodeInput || applyCode.isPending}
                      className="px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 text-zinc-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      Apply Code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-emerald-500/10 bg-emerald-500/5 text-emerald-400/90 text-xs font-medium">
                  ✓ Referral code applied: you were referred by <span className="font-mono font-bold">{refStats.referredByCode}</span>
                </div>
              )}
            </div>

            {/* List of Sent Invites */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 mb-2">Your Sent Invites</h4>
              {!refStats?.invites || refStats.invites.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic">No invites sent yet.</p>
              ) : (
                <div className="max-h-[150px] overflow-y-auto border border-zinc-855 rounded-lg divide-y divide-zinc-900">
                  {refStats.invites.map((invite) => (
                    <div key={invite.id} className="p-2.5 flex items-center justify-between text-xs bg-zinc-950/20">
                      <span className="text-zinc-300 font-medium truncate max-w-[180px]">{invite.referredEmail}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          invite.status === "rewarded"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {invite.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Subscription & Data Policy */}
        <div className="space-y-8">
          {/* Subscription Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md">
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <Settings size={16} className="text-zinc-400" />
              Subscription & Plan
            </h3>
            <p className="text-zinc-400 text-xs mb-6">
              You are currently on the <span className="text-white font-semibold capitalize">{sub?.plan ?? "free"}</span> plan.
            </p>

            <div className="p-4 rounded-xl border border-zinc-855 bg-zinc-950/40 space-y-4 mb-6">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium">Trial Period Status</span>
                <span className="text-zinc-300 font-semibold">
                  {sub?.trialDaysRemaining ?? 14} days remaining
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full animate-pulse"
                  style={{ width: `${Math.min(100, Math.max(0, ((sub?.trialDaysRemaining ?? 14) / 14) * 100))}%` }}
                />
              </div>
            </div>

            {isSubscribed ? (
              <button
                onClick={() => portalSession.mutate()}
                disabled={portalSession.isPending}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 text-zinc-200 font-medium rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {portalSession.isPending ? "Loading..." : "Manage Billing Portal"}
              </button>
            ) : (
              <button
                onClick={() => checkoutSession.mutate({ priceId: "price_mock_premium" })}
                disabled={checkoutSession.isPending}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                {checkoutSession.isPending ? "Processing..." : "Upgrade to Premium ($20/mo)"}
              </button>
            )}
          </div>

            {/* Privacy & Compliance Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md space-y-6">
            <h3 className="text-md font-bold text-zinc-200 flex flex-row items-center gap-2">
              <Lock size={16} className="text-rose-400" />
              Security & Privacy Compliance
            </h3>

            {/* Viral Signature Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-300">Viral Email Signature</h4>
                  <p className="text-zinc-500 text-[11px] leading-relaxed max-w-[85%] mt-1">
                    Automatically append a sleek brand signature to outgoing emails to earn referral credits when friends sign up.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !(userProfile?.viralSignatureEnabled ?? true);
                    updateSettings.mutate({ viralSignatureEnabled: nextVal });
                  }}
                  disabled={updateSettings.isPending}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    (userProfile?.viralSignatureEnabled ?? true) ? "bg-indigo-600" : "bg-zinc-800"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      (userProfile?.viralSignatureEnabled ?? true) ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 font-mono text-[10px] text-zinc-400 select-none">
                <span className="text-zinc-500">Preview:</span>
                <div className="mt-1 whitespace-pre">
                  {"--\nSent with Gusion Mail - https://mail.gusion.in"}
                </div>
              </div>
            </div>

            {/* Export data */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-300">Export Personal Data</h4>
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Download a complete payload of all your stored data, templates, bookings, scheduling links, and email metadata.
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1 px-4 py-2 border border-zinc-855 hover:bg-zinc-900 text-zinc-300 rounded-lg text-xs transition font-semibold cursor-pointer disabled:opacity-50"
              >
                <Download size={13} />
                <span>{exporting ? "Compiling export..." : "Export Data (JSON)"}</span>
              </button>
            </div>

            {/* Delete Account */}
            <div className="space-y-2 border-t border-zinc-900 pt-6">
              <h4 className="text-xs font-semibold text-rose-400">Permanently Delete Account</h4>
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Permanently purge your account, revoke Google scopes, and wipe your data from the sandbox. This action is irreversible.
              </p>
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="flex items-center gap-1 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete Account</span>
              </button>
            </div>

            {/* Legal Links */}
            <div className="border-t border-zinc-900 pt-6 flex gap-4 text-xs font-medium text-zinc-500">
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-300 flex items-center gap-1 transition"
              >
                <span>Privacy Policy</span>
                <ExternalLink size={10} />
              </a>
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-300 flex items-center gap-1 transition"
              >
                <span>Terms of Service</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-zinc-900 bg-zinc-900 shadow-2xl relative space-y-4">
            <h3 className="text-md font-bold text-rose-400">Permanently Delete Account?</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              This will completely wipe your local mail sync cache, delete calendar references, and revoke all Google credentials.
            </p>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Type &quot;delete my account permanently&quot; to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-rose-500 transition"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteAccount.mutate();
                }}
                disabled={deleteConfirmText !== "delete my account permanently" || deleteAccount.isPending}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteAccount.isPending ? "Purging..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function LoaderIcon() {
  return <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />;
}
