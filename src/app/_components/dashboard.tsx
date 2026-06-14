import { useState, useMemo, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import { useShortcuts } from "@/app/_hooks/use-shortcuts";
import { CommandPalette } from "@/app/_components/command-palette";
import { AgentDrawer } from "@/app/_components/agent-drawer";
import { AutomationsSettingsView } from "@/app/_components/automations-settings";
import { DeveloperSettingsView } from "@/app/_components/developer-settings";
import { SuppressionListSettingsView } from "@/app/_components/suppression-settings";
import { BulkMergeView } from "@/app/_components/bulk-merge";
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
  Terminal,
  Sliders,
  Eye,
  EyeOff,
  UserCheck,
  Play,
  FileSpreadsheet,
  Activity,
  Check,
  Edit,
  Shield,
} from "lucide-react";



export function Dashboard() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<"gmail" | "calendar" | "settings" | "tickets" | "bulk">("gmail");
  const [inboxTab, setInboxTab] = useState<"important" | "other" | "vip" | "all">("all");
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
  const [aiComposePrompt, setAiComposePrompt] = useState("");
  const [showSnoozeDropdown, setShowSnoozeDropdown] = useState(false);
  const [showSendLaterDropdown, setShowSendLaterDropdown] = useState(false);

  // Undo Send state
  const [undoActive, setUndoActive] = useState(false);
  const [undoDraft, setUndoDraft] = useState<{ to: string; subject: string; body: string; sendAt?: Date } | null>(null);
  const [undoTimeoutId, setUndoTimeoutId] = useState<NodeJS.Timeout | null>(null);

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

    // Don't close on error: let the browser's EventSource auto-reconnect
    // (e.g. when the serverless SSE function reaches its max duration).
    eventSource.onerror = () => {
      // transient; EventSource will retry automatically
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
    { query: debouncedSearch, limit: 30, tab: inboxTab },
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

  const snoozeEmail = api.gmail.snoozeEmail.useMutation({
    onSuccess: () => {
      toast.success("Email snoozed!");
      setActiveMessageId(null);
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to snooze email."),
  });

  const scheduleSend = api.gmail.scheduleSend.useMutation({
    onSuccess: () => {
      toast.success("Email scheduled successfully!");
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to schedule send."),
  });

  const triggerSendEmail = (to: string, subject: string, body: string, sendAt?: Date) => {
    setComposeOpen(false);
    setUndoDraft({ to, subject, body, sendAt });
    setUndoActive(true);

    const toastId = toast.info(
      sendAt
        ? `Scheduling send for ${sendAt.toLocaleString()}...`
        : "Sending email in 5s...",
      {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            handleUndoSend(to, subject, body, sendAt);
          },
        },
      }
    );

    const timeoutId = setTimeout(() => {
      if (sendAt) {
        scheduleSend.mutate({ to, subject, body, sendAt });
      } else {
        sendEmail.mutate({ to, subject, body });
      }
      setUndoActive(false);
      setUndoDraft(null);
      setUndoTimeoutId(null);
      toast.dismiss(toastId);
    }, 5000);

    setUndoTimeoutId(timeoutId);
  };

  const handleUndoSend = (to: string, subject: string, body: string, sendAt?: Date) => {
    setUndoActive((active) => {
      if (!active) return false;
      setComposeTo(to);
      setComposeSubject(subject);
      setComposeBody(body);
      setComposeOpen(true);
      toast.success("Sending cancelled. Draft restored.");
      return false;
    });

    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      setUndoTimeoutId(null);
    }
    setUndoDraft(null);
  };

  const generateAiDraft = api.ai.aiCompose.useMutation({
    onSuccess: (res) => {
      setComposeBody(res.text);
      setAiComposePrompt("");
      toast.success("AI draft generated!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate draft.");
    },
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

  const [smartReplies, setSmartReplies] = useState<{ label: string; body: string }[]>([]);
  const [threadSummary, setThreadSummary] = useState<string | null>(null);

  const getSmartReplies = api.ai.aiSmartReply.useMutation({
    onSuccess: (res) => {
      setSmartReplies(res.replies);
    },
    onError: () => {
      setSmartReplies([]);
    },
  });

  const summarizeThread = api.ai.aiSummarize.useMutation({
    onSuccess: (res) => {
      setThreadSummary(res.summary);
      toast.success("Summary generated!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to summarize thread.");
    },
  });

  const { data: dailyBriefData } = api.ai.aiDailyBrief.useQuery(undefined, {
    enabled: activeTab === "gmail" && !activeMessageId,
    retry: false,
  });

  useEffect(() => {
    if (activeMessageId) {
      setThreadSummary(null);
      setSmartReplies([]);
      getSmartReplies.mutate({ messageId: activeMessageId });
    }
  }, [activeMessageId, getSmartReplies]);

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
                setActiveTab("tickets");
                setAgentOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                activeTab === "tickets"
                  ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <HelpCircle size={16} />
              <span>Support Queue</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("bulk");
                setAgentOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                activeTab === "bulk"
                  ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <FileSpreadsheet size={16} />
              <span>Bulk Campaign</span>
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

              {/* Split Inbox Tabs */}
              <div className="flex border-b border-zinc-900 px-2 bg-zinc-950/20 text-xs">
                <button
                  onClick={() => setInboxTab("important")}
                  className={`flex-1 py-2.5 text-center border-b-2 font-medium transition cursor-pointer ${
                    inboxTab === "important"
                      ? "border-indigo-500 text-indigo-400 font-semibold"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Important
                </button>
                <button
                  onClick={() => setInboxTab("other")}
                  className={`flex-1 py-2.5 text-center border-b-2 font-medium transition cursor-pointer ${
                    inboxTab === "other"
                      ? "border-indigo-500 text-indigo-400 font-semibold"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Other
                </button>
                <button
                  onClick={() => setInboxTab("vip")}
                  className={`flex-1 py-2.5 text-center border-b-2 font-medium transition cursor-pointer ${
                    inboxTab === "vip"
                      ? "border-indigo-500 text-indigo-400 font-semibold"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  VIP
                </button>
                <button
                  onClick={() => setInboxTab("all")}
                  className={`flex-1 py-2.5 text-center border-b-2 font-medium transition cursor-pointer ${
                    inboxTab === "all"
                      ? "border-indigo-500 text-indigo-400 font-semibold"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  All
                </button>
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
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-semibold text-zinc-300 truncate max-w-[150px]">
                            {parseEmailAddress(email.from).name || parseEmailAddress(email.from).email}
                          </span>
                          {email.priority && email.priority !== "normal" && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                              email.priority === "urgent"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : email.priority === "high"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-zinc-800 text-zinc-400"
                            }`}>
                              {email.priority}
                            </span>
                          )}
                          {email.category === "important" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                              Important
                            </span>
                          )}
                        </div>
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
                <div className="flex-1 flex flex-col justify-start p-6 overflow-y-auto space-y-6">
                  {/* Daily Brief Header */}
                  <div className="p-5 rounded-2xl border border-zinc-900 bg-zinc-900/10 backdrop-blur-md relative overflow-hidden space-y-3">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                    <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                      <Sparkles size={14} className="text-indigo-400" />
                      Your Daily Briefing
                    </h3>
                    {dailyBriefData?.brief ? (
                      <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap text-left font-medium">
                        {dailyBriefData.brief}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500 italic text-left">
                        Scanning your inbox for important updates...
                      </p>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-center">
                    <div className="w-12 h-12 rounded-full border border-zinc-900 bg-zinc-900/20 flex items-center justify-center mb-4">
                      <Mail size={20} />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">No thread selected</h3>
                    <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                      Select an email from the inbox list or press <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">Enter</kbd> to read a conversation.
                    </p>
                  </div>
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
                    <div className="flex items-center gap-2 flex-shrink-0 relative">
                      <button
                        onClick={() => archiveEmail.mutate({ id: selectedMessage.id })}
                        className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer"
                        title="Archive Email (e)"
                      >
                        <Archive size={16} />
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setShowSnoozeDropdown(!showSnoozeDropdown)}
                          className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer"
                          title="Snooze"
                        >
                          <Clock size={16} />
                        </button>
                        {showSnoozeDropdown && (
                          <div className="absolute right-0 mt-2 w-64 p-3 rounded-xl border border-zinc-850 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 text-left space-y-2">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 px-1">Snooze Email Until</div>
                            <button
                              onClick={() => {
                                const d = new Date();
                                d.setHours(d.getHours() + 3);
                                snoozeEmail.mutate({ id: selectedMessage.id, snoozeUntil: d });
                                setShowSnoozeDropdown(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition flex justify-between cursor-pointer"
                            >
                              <span>Later today</span>
                              <span className="text-[10px] text-zinc-550">
                                {new Date(Date.now() + 3 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 1);
                                d.setHours(8, 0, 0, 0);
                                snoozeEmail.mutate({ id: selectedMessage.id, snoozeUntil: d });
                                setShowSnoozeDropdown(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition flex justify-between cursor-pointer"
                            >
                              <span>Tomorrow morning</span>
                              <span className="text-[10px] text-zinc-550">8:00 AM</span>
                            </button>
                            <button
                              onClick={() => {
                                const d = new Date();
                                const daysToAdd = (1 + 7 - d.getDay()) % 7 || 7;
                                d.setDate(d.getDate() + daysToAdd);
                                d.setHours(8, 0, 0, 0);
                                snoozeEmail.mutate({ id: selectedMessage.id, snoozeUntil: d });
                                setShowSnoozeDropdown(false);
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-305 hover:bg-zinc-900/50 transition flex justify-between cursor-pointer"
                            >
                              <span>Next week</span>
                              <span className="text-[10px] text-zinc-550">Mon 8:00 AM</span>
                            </button>
                            <div className="border-t border-zinc-900 my-1" />
                            <div className="px-1 space-y-1">
                              <label className="block text-[9px] text-zinc-500 font-semibold">Custom date & time</label>
                              <input
                                type="datetime-local"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const d = new Date(e.target.value);
                                    snoozeEmail.mutate({ id: selectedMessage.id, snoozeUntil: d });
                                    setShowSnoozeDropdown(false);
                                  }
                                }}
                                className="w-full px-2 py-1 bg-zinc-900 border border-zinc-850 rounded text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reading Pane Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* AI Summary Card */}
                    <div className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={10} />
                          AI Thread Summary
                        </span>
                        {!threadSummary && (
                          <button
                            onClick={() => summarizeThread.mutate({ threadId: selectedMessage.threadId })}
                            disabled={summarizeThread.isPending}
                            className="px-2.5 py-1 text-[10px] font-semibold bg-indigo-600/20 hover:bg-indigo-650 text-indigo-300 hover:text-white rounded transition cursor-pointer disabled:opacity-50"
                          >
                            {summarizeThread.isPending ? "Generating..." : "Generate Summary"}
                          </button>
                        )}
                      </div>
                      {threadSummary ? (
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {threadSummary}
                        </p>
                      ) : !summarizeThread.isPending ? (
                        <p className="text-[11px] text-zinc-500 italic">
                          Click above to generate a brief summary of this conversation.
                        </p>
                      ) : (
                        <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
                      )}
                    </div>

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

                      {/* AI Smart Replies Suggestions */}
                      {smartReplies.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {smartReplies.map((reply, index) => (
                            <button
                              key={index}
                              onClick={() => setReplyBody(reply.body)}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-indigo-600 border border-zinc-800 hover:border-indigo-500 text-zinc-300 hover:text-white text-xs rounded-full transition cursor-pointer text-left"
                              title={reply.body}
                            >
                              💡 {reply.label}
                            </button>
                          ))}
                        </div>
                      )}

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
        {activeTab === "bulk" && <BulkMergeView />}
        {activeTab === "tickets" && (
          <TicketsView
            onOpenMessage={(msgId) => {
              setActiveTab("gmail");
              setActiveMessageId(msgId);
            }}
          />
        )}
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
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-2">
                <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider">✨ Write with AI</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Write a friendly follow-up about the project budget..."
                    value={aiComposePrompt}
                    onChange={(e) => setAiComposePrompt(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-855 rounded-md text-xs text-zinc-200 placeholder:text-zinc-505 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    onClick={() => generateAiDraft.mutate({ prompt: aiComposePrompt })}
                    disabled={!aiComposePrompt || generateAiDraft.isPending}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    <span>{generateAiDraft.isPending ? "Drafting..." : "Draft"}</span>
                  </button>
                </div>
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
              <div className="relative flex items-center">
                <button
                  onClick={() => triggerSendEmail(composeTo, composeSubject, composeBody)}
                  disabled={!composeTo || !composeSubject || !composeBody || sendEmail.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-l-lg transition cursor-pointer flex items-center gap-1 disabled:opacity-50 border-r border-indigo-500/20"
                >
                  <span>Send</span>
                  <Send size={10} />
                </button>
                <button
                  onClick={() => setShowSendLaterDropdown(!showSendLaterDropdown)}
                  disabled={!composeTo || !composeSubject || !composeBody}
                  className="px-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-r-lg transition cursor-pointer flex items-center justify-center disabled:opacity-50"
                  title="Schedule Send"
                >
                  <Clock size={12} />
                </button>

                {showSendLaterDropdown && (
                  <div className="absolute right-0 bottom-full mb-2 w-64 p-3 rounded-xl border border-zinc-850 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 text-left space-y-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 px-1">Schedule Send</div>
                    <button
                      onClick={() => {
                        const d = new Date();
                        d.setHours(d.getHours() + 1);
                        triggerSendEmail(composeTo, composeSubject, composeBody, d);
                        setShowSendLaterDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition flex justify-between cursor-pointer"
                    >
                      <span>In 1 hour</span>
                      <span className="text-[10px] text-zinc-550">
                        {new Date(Date.now() + 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        d.setHours(8, 0, 0, 0);
                        triggerSendEmail(composeTo, composeSubject, composeBody, d);
                        setShowSendLaterDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition flex justify-between cursor-pointer"
                    >
                      <span>Tomorrow morning</span>
                      <span className="text-[10px] text-zinc-550">8:00 AM</span>
                    </button>
                    <div className="border-t border-zinc-900 my-1" />
                    <div className="px-1 space-y-1">
                      <label className="block text-[9px] text-zinc-500 font-semibold">Custom date & time</label>
                      <input
                        type="datetime-local"
                        onChange={(e) => {
                          if (e.target.value) {
                            const d = new Date(e.target.value);
                            triggerSendEmail(composeTo, composeSubject, composeBody, d);
                            setShowSendLaterDropdown(false);
                          }
                        }}
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-850 rounded text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>
                )}
              </div>
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
  const [settingsSubTab, setSettingsSubTab] = useState<"general" | "automations" | "developer" | "suppression">("general");
  const [inviteEmail, setInviteEmail] = useState("");
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);

  // Scheduling states
  const [linkTitle, setLinkTitle] = useState("");
  const [linkSlug, setLinkSlug] = useState("");
  const [linkDuration, setLinkDuration] = useState(30);
  const [linkBuffer, setLinkBuffer] = useState(0);

  // VIP Contacts states
  const [vipSearch, setVipSearch] = useState("");
  const [newVipEmail, setNewVipEmail] = useState("");
  const [newVipName, setNewVipName] = useState("");

  // Org states
  const [orgInviteEmail, setOrgInviteEmail] = useState("");
  const [orgInviteRole, setOrgInviteRole] = useState<"admin" | "member">("member");
  const [newOrgName, setNewOrgName] = useState("");

  // Queries
  const { data: sub } = api.billing.getSubscription.useQuery();
  const { data: refStats, refetch: refetchRefStats } = api.referral.getReferralStats.useQuery();
  const { data: userProfile } = api.auth.me.useQuery();
  const { data: links, refetch: refetchLinks } = api.scheduling.listLinks.useQuery();
  const { data: contactsData, refetch: refetchContacts } = api.contacts.listContacts.useQuery({
    searchQuery: vipSearch,
  });
  const { data: activeOrg, refetch: refetchOrg } = api.org.getOrg.useQuery();
  const { data: orgMembersList, refetch: refetchMembers } = api.org.listMembers.useQuery();

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
  const createLink = api.scheduling.createLink.useMutation({
    onSuccess: () => {
      toast.success("Scheduling link created!");
      setLinkTitle("");
      setLinkSlug("");
      setLinkDuration(30);
      setLinkBuffer(0);
      void refetchLinks();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create scheduling link.");
    },
  });

  const toggleLink = api.scheduling.toggleLink.useMutation({
    onSuccess: () => {
      toast.success("Link status updated!");
      void refetchLinks();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update link status.");
    },
  });

  const addVipContact = api.contacts.addContact.useMutation({
    onSuccess: () => {
      toast.success("VIP contact added!");
      setNewVipEmail("");
      setNewVipName("");
      void refetchContacts();
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add VIP contact.");
    },
  });

  const toggleVipContact = api.contacts.toggleVip.useMutation({
    onSuccess: () => {
      toast.success("VIP status updated!");
      void refetchContacts();
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to toggle VIP status.");
    },
  });

  const inviteOrgMember = api.org.inviteMember.useMutation({
    onSuccess: () => {
      toast.success("Member invited successfully!");
      setOrgInviteEmail("");
      void refetchMembers();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to invite member.");
    },
  });

  const updateMemberRole = api.org.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Member role updated!");
      void refetchMembers();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update member role.");
    },
  });

  const removeOrgMember = api.org.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed from team!");
      void refetchMembers();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove member.");
    },
  });

  const updateOrgName = api.org.updateOrgName.useMutation({
    onSuccess: () => {
      toast.success("Organization name updated!");
      void refetchOrg();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update organization name.");
    },
  });

  const handleCreateLink = () => {
    createLink.mutate({
      title: linkTitle,
      slug: linkSlug,
      durationMins: linkDuration,
      bufferMins: linkBuffer,
    });
  };

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

      {/* Sub tabs */}
      <div className="flex border-b border-zinc-900 gap-6 text-sm font-medium">
        <button
          onClick={() => setSettingsSubTab("general")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "general"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          General Settings
        </button>
        <button
          onClick={() => setSettingsSubTab("automations")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "automations"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Rules & Automations
        </button>
        <button
          onClick={() => setSettingsSubTab("developer")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "developer"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Developer API & Webhooks
        </button>
        <button
          onClick={() => setSettingsSubTab("suppression")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "suppression"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Suppression List
        </button>
      </div>

      {settingsSubTab === "general" && (
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

          {/* Scheduling Links Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <CalendarIcon size={16} className="text-indigo-400" />
              Scheduling & Booking Links
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              Create and share booking links so contacts can schedule meetings directly over your calendar slots.
            </p>

            {/* Link Creation Form */}
            <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 space-y-4 mb-6 text-left">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Create New Link</span>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Title</label>
                  <input
                    type="text"
                    placeholder="e.g. 30 Min Sync"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-205 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Slug</label>
                  <input
                    type="text"
                    placeholder="e.g. 30min"
                    value={linkSlug}
                    onChange={(e) => setLinkSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-205 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={5}
                    value={linkDuration}
                    onChange={(e) => setLinkDuration(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-205 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Buffer (Mins)</label>
                  <input
                    type="number"
                    min={0}
                    value={linkBuffer}
                    onChange={(e) => setLinkBuffer(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-205 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateLink}
                disabled={!linkTitle || !linkSlug || createLink.isPending}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {createLink.isPending ? "Creating..." : "Create Booking Link"}
              </button>
            </div>

            {/* List of links */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 mb-2">Your Active Links</h4>
              {!links || links.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-left">No scheduling links configured.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {links.map((link) => (
                    <div key={link.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-zinc-250 truncate">{link.title}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate select-all">
                          {`${typeof window !== "undefined" ? window.location.origin : ""}/book/${link.slug}`}
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-1">
                          {link.durationMins}m duration · {link.bufferMins}m buffer
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleLink.mutate({ id: link.id, isActive: !link.isActive })}
                          className={`px-2 py-1 text-[10px] font-semibold rounded transition cursor-pointer ${
                            link.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {link.isActive ? "Active" : "Paused"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* VIP Contacts Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden mt-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              VIP Senders & Contacts
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              Mark key clients, stakeholders, or users as VIPs to highlight their emails in the VIP inbox tab.
            </p>

            {/* VIP Search / Add Form */}
            <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 space-y-4 mb-6 text-left">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Add VIP Contact</span>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="partner@company.com"
                    value={newVipEmail}
                    onChange={(e) => setNewVipEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={newVipName}
                    onChange={(e) => setNewVipName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>
              <button
                onClick={() => addVipContact.mutate({ email: newVipEmail, name: newVipName, isVip: true })}
                disabled={!newVipEmail || addVipContact.isPending}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {addVipContact.isPending ? "Adding..." : "Add VIP Contact"}
              </button>
            </div>

            {/* List and search */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-zinc-400">Manage VIPs</h4>
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={vipSearch}
                  onChange={(e) => setVipSearch(e.target.value)}
                  className="px-2 py-1 bg-zinc-950 border border-zinc-855 rounded text-[11px] text-zinc-300 placeholder:text-zinc-650 focus:outline-none focus:border-amber-500 transition w-32"
                />
              </div>

              {!contactsData || contactsData.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-left">No contacts found.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {contactsData.map((contact) => (
                    <div key={contact.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-zinc-200 truncate">{contact.name || contact.email}</div>
                        {contact.name && (
                          <div className="text-[10px] text-zinc-550 truncate mt-0.5">{contact.email}</div>
                        )}
                        <div className="text-[9px] text-zinc-450 mt-1">
                          {contact.interactionCount} interactions
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleVipContact.mutate({ email: contact.email, isVip: !contact.isVip })}
                          className={`px-2 py-1 text-[10px] font-semibold rounded transition cursor-pointer ${
                            contact.isVip
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {contact.isVip ? "VIP" : "Regular"}
                        </button>
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
          {/* Organization & Team Settings Card */}
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-md font-bold text-zinc-200 mb-2 flex flex-row items-center gap-2">
              <Plus size={16} className="text-indigo-400" />
              Organization & Team Settings
            </h3>
            <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
              Manage your company or workspace organization settings and invite team members to collaborate.
            </p>

            {/* Active Org Name Form */}
            {activeOrg && (
              <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40 mb-6 text-left space-y-3">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Workspace Name</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Workspace Name"
                    defaultValue={activeOrg.name}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {(activeOrg.role === "owner" || activeOrg.role === "admin") && (
                    <button
                      onClick={() => updateOrgName.mutate({ name: newOrgName || activeOrg.name })}
                      disabled={updateOrgName.isPending}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Save
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  Your Role: <span className="font-semibold text-zinc-350 capitalize">{activeOrg.role}</span>
                </div>
              </div>
            )}

            {/* Team Members List */}
            <div className="space-y-4 mb-6">
              <h4 className="text-xs font-semibold text-zinc-400 text-left">Team Members</h4>
              {!orgMembersList || orgMembersList.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-left">No team members found.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {orgMembersList.map((member) => (
                    <div key={member.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-zinc-200 truncate">{member.name || member.email}</div>
                        <div className="text-[10px] text-zinc-550 truncate mt-0.5">{member.email}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {member.role === "owner" ? (
                          <span className="px-2 py-0.5 text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded capitalize font-medium">
                            Owner
                          </span>
                        ) : (activeOrg?.role === "owner" || activeOrg?.role === "admin") ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={member.role}
                              onChange={(e) => updateMemberRole.mutate({ memberId: member.id, role: e.target.value as any })}
                              className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 focus:outline-none"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() => removeOrgMember.mutate({ memberId: member.id })}
                              className="text-rose-400 hover:text-rose-300 p-0.5 transition cursor-pointer"
                              title="Remove member"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] bg-zinc-900 text-zinc-400 rounded capitalize font-medium">
                            {member.role}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invite New Team Member Form */}
            {(activeOrg?.role === "owner" || activeOrg?.role === "admin") && (
              <div className="p-4 rounded-xl border border-zinc-855 bg-zinc-950/40 space-y-4 text-left">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Invite Member</span>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={orgInviteEmail}
                      onChange={(e) => setOrgInviteEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-550 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 font-semibold mb-1">Role</label>
                    <select
                      value={orgInviteRole}
                      onChange={(e) => setOrgInviteRole(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-855 rounded-lg text-xs text-zinc-300 focus:outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => inviteOrgMember.mutate({ email: orgInviteEmail, role: orgInviteRole })}
                  disabled={!orgInviteEmail || inviteOrgMember.isPending}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {inviteOrgMember.isPending ? "Sending..." : "Send Invite"}
                </button>
              </div>
            )}
          </div>

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
                onClick={() => checkoutSession.mutate({})}
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
      )}

      {settingsSubTab === "automations" && <AutomationsSettingsView />}
      {settingsSubTab === "developer" && <DeveloperSettingsView />}
      {settingsSubTab === "suppression" && <SuppressionListSettingsView />}

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

function TicketsView({
  onOpenMessage,
}: {
  onOpenMessage: (messageId: string) => void;
}) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } = api.tickets.listTickets.useQuery();
  const { data: teamMembers } = api.org.listMembers.useQuery();

  const updateStatus = api.tickets.updateTicketStatus.useMutation({
    onSuccess: () => {
      toast.success("Ticket status updated!");
      void refetchTickets();
    },
    onError: (err) => toast.error(err.message || "Failed to update status."),
  });

  const assignTicket = api.tickets.assignTicket.useMutation({
    onSuccess: () => {
      toast.success("Ticket assignee updated!");
      void refetchTickets();
    },
    onError: (err) => toast.error(err.message || "Failed to assign ticket."),
  });

  const selectedTicket = useMemo(() => {
    return ticketsData?.find((t) => t.id === selectedTicketId) || null;
  }, [ticketsData, selectedTicketId]);

  return (
    <section className="flex-1 flex h-full overflow-hidden">
      {/* Ticket List Pane */}
      <div className="w-96 border-r border-zinc-900 flex flex-col bg-zinc-950/20 backdrop-blur-md">
        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Support Tickets</h2>
          <button
            onClick={() => void refetchTickets()}
            className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60">
          {ticketsLoading ? (
            <div className="p-6 text-zinc-500 text-xs text-center">Loading tickets...</div>
          ) : !ticketsData || ticketsData.length === 0 ? (
            <div className="p-6 text-zinc-500 text-xs text-center">No support tickets found.</div>
          ) : (
            ticketsData.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`w-full p-4 flex flex-col gap-1.5 transition text-left cursor-pointer ${
                  selectedTicketId === ticket.id ? "bg-zinc-900/40" : "hover:bg-zinc-900/10"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                    {ticket.publicId}
                  </span>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded uppercase ${
                    ticket.status === "open"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : ticket.status === "pending"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-zinc-200 truncate">{ticket.subject}</div>
                <div className="text-[10px] text-zinc-400 truncate">From: {ticket.fromName || ticket.fromEmail}</div>
                <div className="text-[9px] text-zinc-500 truncate mt-1">
                  {ticket.assignedUser ? `Assigned to: ${ticket.assignedUser.name}` : "Unassigned"}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Ticket Reading / Actions Pane */}
      <div className="flex-1 flex flex-col bg-zinc-950/40 backdrop-blur-md overflow-hidden">
        {!selectedTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-650 text-center">
            <HelpCircle size={32} className="mb-3 text-zinc-750" />
            <h3 className="text-sm font-semibold text-zinc-300 mb-1">No ticket selected</h3>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              Select a ticket from the left panel to manage status, assignments, and view conversations.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden text-left">
            {/* Header */}
            <div className="p-6 border-b border-zinc-900 flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded">
                    {selectedTicket.publicId}
                  </span>
                  <span className="text-zinc-500 text-xs">
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">{selectedTicket.subject}</h2>
                <div className="text-xs text-zinc-400 mt-2">
                  <span className="text-zinc-550 font-medium">Customer: </span>
                  {selectedTicket.fromName ? `${selectedTicket.fromName} (${selectedTicket.fromEmail})` : selectedTicket.fromEmail}
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="p-6 border-b border-zinc-900 grid grid-cols-2 gap-4 bg-zinc-950/20">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Ticket Status</label>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateStatus.mutate({ id: selectedTicket.id, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Assignee</label>
                <select
                  value={selectedTicket.assignedUserId ?? ""}
                  onChange={(e) => assignTicket.mutate({ id: selectedTicket.id, userId: e.target.value || null })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="">Unassigned</option>
                  {teamMembers?.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Details & Conversation Link */}
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Ticket Description (Snippet)</h4>
                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/30 text-xs text-zinc-300 leading-relaxed italic">
                  &quot;{selectedTicket.snippet || "No description provided."}&quot;
                </div>
              </div>

              {selectedTicket.gmailMessageId && (
                <div className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Superhuman Email Client Integration</span>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    This support ticket is linked directly to an active email thread in your inbox. Open it to write an AI-powered reply, snooze, or archive the thread.
                  </p>
                  <button
                    onClick={() => {
                      if (selectedTicket.gmailMessageId) {
                        onOpenMessage(selectedTicket.gmailMessageId);
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Mail size={12} />
                    <span>Open Email Conversation</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
