import { useState, useMemo, useEffect, useRef } from "react";
import { signOut, signIn, useSession } from "next-auth/react";
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
import { TemplatesSettingsView } from "@/app/_components/templates-settings";
import { ContactsSidePanel } from "@/app/_components/contacts-panel";
import { ShortcutTutorial } from "@/app/_components/shortcut-tutorial";
import { Sidebar } from "@/app/_components/dashboard/sidebar";
import { ReadingPane } from "@/app/_components/dashboard/reading-pane";
import { CalendarView } from "@/app/_components/dashboard/calendar-view";
import { TicketsView } from "@/app/_components/dashboard/support-queue";
import { SubscriptionManager } from "@/app/_components/subscription-manager";
import { ConnectedAccountsSettings } from "@/app/_components/connected-accounts-settings";
import { CommandCenter } from "@/app/_components/dashboard/command-center";
import { MiniCalendarWidget } from "@/app/_components/dashboard/mini-calendar-widget";
import { EmailSidePanel } from "@/app/_components/dashboard/email-sidebar-panel";
import { InboxList } from "@/app/_components/dashboard/inbox-list";

export function formatMessageDate(dateStr: string | null) {
  if (!dateStr) return "";
  // internalDate from Gmail is a ms-since-epoch string (e.g. "1718739600000")
  const ms = Number(dateStr);
  const date = isNaN(ms) ? new Date(dateStr) : new Date(ms);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function parseEmailAddress(headerValue: string) {
  const match = /^(.*)<(.*)>$/.exec(headerValue.trim());
  if (match) {
    return { name: match[1]!.replace(/"/g, "").trim(), email: match[2]!.trim() };
  }
  return { name: "", email: headerValue.trim() };
}

export function formatSender(headerValue: string) {
  const { name, email } = parseEmailAddress(headerValue);
  return name || email.split("@")[0] || headerValue;
}

type EventFormErrors = Partial<Record<"summary" | "start" | "end" | "attendees", string>>;

const EVENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function formatTimeInputValue(date: Date) {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function buildDateTimeFromParts(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);

  if (!year || !month || !day || hours === undefined || minutes === undefined) {
    return null;
  }

  const result = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

function getDefaultEventDateTimes() {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
  if (start.getMinutes() === 0 && start.getSeconds() === 0) {
    start.setHours(start.getHours() + 1);
  }

  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    startDate: formatDateInputValue(start),
    startTime: formatTimeInputValue(start),
    endDate: formatDateInputValue(end),
    endTime: formatTimeInputValue(end),
  };
}

function applyIsoDateTimeToFields(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date: formatDateInputValue(date),
    time: formatTimeInputValue(date),
  };
}

function parseAttendeeEmails(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
  FileSpreadsheet,
  Bell,
  Loader2,
} from "lucide-react";



export function Dashboard() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [activeTab, setActiveTab] = useState<"gmail" | "calendar" | "settings" | "tickets" | "bulk" | "inbox">("gmail");
  const [inboxTab, setInboxTab] = useState<"important" | "other" | "vip" | "all">("all");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(/Mac|iPod|iPad|iPhone/.test(window.navigator.userAgent));
    }
  }, []);

  // Compose state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [aiComposePrompt, setAiComposePrompt] = useState("");
  const [showSnoozeDropdown, setShowSnoozeDropdown] = useState(false);
  const [showSendLaterDropdown, setShowSendLaterDropdown] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);

  // Multi-select state
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());

  const toggleEmailSelection = (id: string) => {
    setSelectedEmailIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedEmailIds(new Set());
  };

  // Undo Send state
  const [, setUndoActive] = useState(false);
  const [, setUndoDraft] = useState<{ to: string; subject: string; body: string; sendAt?: Date } | null>(null);
  const [undoTimeoutId, setUndoTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Reply inline state
  const [replyBody, setReplyBody] = useState("");

  // Calendar week state
  const [weekOffset, setWeekOffset] = useState(0);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [eventSummary, setEventSummary] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventLoc, setEventLoc] = useState("");
  const [eventPrompt, setEventPrompt] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventAttendees, setEventAttendees] = useState("");
  const [eventErrors, setEventErrors] = useState<EventFormErrors>({});

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Realtime updates subscription via WebSocket with SSE fallback
  useEffect(() => {
    let ws: WebSocket | null = null;
    let eventSource: EventSource | null = null;
    
    const handleMessage = (data: string) => {
      if (data === "connected" || data === "ping") return;
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        
        // Skip events meant for other users
        if (parsed.userId && session?.user?.id && parsed.userId !== session.user.id) {
          return;
        }

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

    const setupSSE = () => {
      if (eventSource) return;
      eventSource = new EventSource("/api/realtime");
      eventSource.onmessage = (event) => {
        handleMessage(typeof event.data === "string" ? event.data : "");
      };
    };

    const setupWS = () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          handleMessage(typeof event.data === "string" ? event.data : "");
        };

        ws.onerror = () => {
          console.warn("WebSocket error, falling back to SSE");
          if (ws) ws.close(); // Triggers onclose
        };

        ws.onclose = () => {
          console.log("WebSocket connection closed, setting up SSE fallback.");
          setupSSE();
        };
      } catch (err) {
        console.warn("WebSocket initialization failed, falling back to SSE:", err);
        setupSSE();
      }
    };

    setupWS();

    return () => {
      if (ws) {
        ws.onclose = null; // Prevent fallback when unmounting
        ws.close();
      }
      if (eventSource) eventSource.close();
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
    { enabled: activeTab === "gmail" || activeTab === "inbox", retry: false }
  );

  const { data: selectedMessage, isLoading: messageLoading } = api.gmail.getMessage.useQuery(
    { id: activeMessageId ?? "" },
    { enabled: !!activeMessageId }
  );
  const { data: templates } = api.template.listTemplates.useQuery();

  const refreshInbox = api.gmail.refreshInbox.useMutation({
    onSuccess: (res) => {
      if (res.synced > 0) toast.success(`Synced ${res.synced} emails.`);
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        setGmailAuthError(true);
      } else {
        toast.error("Sync failed.");
      }
    },
  });

  const [gmailAuthError, setGmailAuthError] = useState(false);

  // Auto-sync once on first load when inbox is empty
  const hasAutoSynced = useRef(false);
  useEffect(() => {
    if (!emailsLoading && emails !== undefined && emails.length === 0 && !hasAutoSynced.current) {
      hasAutoSynced.current = true;
      refreshInbox.mutate();
    }
  }, [emailsLoading, emails]);

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

  const handleUndoSend = (to: string, subject: string, body: string, _sendAt?: Date) => {
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
      setComposeBody(res.body);
      if (res.subject) setComposeSubject(res.subject);
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
    // getSmartReplies intentionally excluded: the mutation object gets a new reference on
    // every state update (isPending → isSuccess → etc.), which would re-trigger this effect
    // and cause an infinite loop. We only want to fire when the selected message changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMessageId]);

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

  const createFollowUp = api.gmail.createFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Follow-up reminder set for 2 days from now!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to set follow-up reminder.");
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

  const { data: events, isLoading: eventsLoading, isFetching: eventsFetching, error: eventsError } = api.calendar.searchEvents.useQuery(
    {
      query: "",
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
    },
    { enabled: activeTab === "calendar", retry: false }
  );

  const refreshEvents = api.calendar.refreshEvents.useMutation({
    onSuccess: (res) => {
      toast.success(`Synced ${res.synced} events.`);
      void utils.calendar.searchEvents.invalidate();
    },
    onError: (err) => toast.error(err.message || "Sync failed."),
  });

  const sendInvite = api.calendar.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Calendar invite sent!");
      setCreateEventOpen(false);
      setEventPrompt("");
      setEventSummary("");
      setEventDesc("");
      setEventLoc("");
      setEventStartDate("");
      setEventStartTime("");
      setEventEndDate("");
      setEventEndTime("");
      setEventAttendees("");
      setEventErrors({});
      void utils.calendar.searchEvents.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to create event."),
  });

  const generateCalendarDraft = api.ai.aiCalendarAssist.useMutation({
    onSuccess: (draft) => {
      const startParts = applyIsoDateTimeToFields(draft.start);
      const endParts = applyIsoDateTimeToFields(draft.end);

      setEventSummary(draft.summary);
      setEventDesc(draft.description ?? "");
      setEventLoc(draft.location ?? "");
      setEventAttendees((draft.attendees ?? []).join(", "));

      if (startParts) {
        setEventStartDate(startParts.date);
        setEventStartTime(startParts.time);
      }

      if (endParts) {
        setEventEndDate(endParts.date);
        setEventEndTime(endParts.time);
      }

      setEventErrors({});
      toast.success("Drafted event details from your prompt.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate event draft.");
    },
  });

  const deleteEvent = api.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      toast.success("Event deleted.");
      void utils.calendar.searchEvents.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete event."),
  });

  const syncedCalendarWeeks = useRef(new Set<string>());

  useEffect(() => {
    if (activeTab !== "calendar") return;

    const weekKey = `${weekRange.start}:${weekRange.end}`;
    if (syncedCalendarWeeks.current.has(weekKey)) return;

    syncedCalendarWeeks.current.add(weekKey);
    refreshEvents.mutate({
      weekStart: weekRange.start,
      weekEnd: weekRange.end,
    });
  }, [activeTab, refreshEvents, weekRange.end, weekRange.start]);

  // Keyboard Navigation Focus State
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    setFocusedIndex(0);
  }, [emails, activeTab]);

  useEffect(() => {
    if (!createEventOpen) return;

    setEventErrors({});

    if (eventStartDate || eventStartTime || eventEndDate || eventEndTime) return;

    const defaults = getDefaultEventDateTimes();
    setEventStartDate(defaults.startDate);
    setEventStartTime(defaults.startTime);
    setEventEndDate(defaults.endDate);
    setEventEndTime(defaults.endTime);
  }, [createEventOpen, eventEndDate, eventEndTime, eventStartDate, eventStartTime]);

  const closeCreateEventModal = () => {
    setCreateEventOpen(false);
    setEventPrompt("");
    setEventErrors({});
    setEventSummary("");
    setEventDesc("");
    setEventLoc("");
    setEventStartDate("");
    setEventStartTime("");
    setEventEndDate("");
    setEventEndTime("");
    setEventAttendees("");
  };

  const submitCreateEvent = () => {
    const nextErrors: EventFormErrors = {};
    const trimmedSummary = eventSummary.trim();
    const trimmedLocation = eventLoc.trim();
    const trimmedDescription = eventDesc.trim();
    const attendeesList = parseAttendeeEmails(eventAttendees);
    const invalidAttendees = attendeesList.filter((email) => !EVENT_EMAIL_RE.test(email));
    const startAt = buildDateTimeFromParts(eventStartDate, eventStartTime);
    const endAt = buildDateTimeFromParts(eventEndDate, eventEndTime);

    if (!trimmedSummary) {
      nextErrors.summary = "Add a clear event title.";
    }

    if (!startAt) {
      nextErrors.start = "Choose a valid start date and time.";
    }

    if (!endAt) {
      nextErrors.end = "Choose a valid end date and time.";
    }

    if (startAt && endAt && endAt <= startAt) {
      nextErrors.end = "End time must be after the start time.";
    }

    if (attendeesList.length === 0) {
      nextErrors.attendees = "Add at least one attendee email.";
    } else if (invalidAttendees.length > 0) {
      nextErrors.attendees = `Fix invalid email${invalidAttendees.length > 1 ? "s" : ""}: ${invalidAttendees.join(", ")}`;
    }

    setEventErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !startAt || !endAt) return;

    sendInvite.mutate({
      summary: trimmedSummary,
      description: trimmedDescription || undefined,
      location: trimmedLocation || undefined,
      start: startAt.toISOString(),
      end: endAt.toISOString(),
      attendees: attendeesList,
    });
  };

  // Keyboard Shortcuts bindings
  useShortcuts({
    "Cmd+ArrowDown": () => {
      if (activeTab === "gmail" && emails && focusedIndex < emails.length - 1) {
        setFocusedIndex((prev) => prev + 1);
      }
    },
    "Cmd+ArrowUp": () => {
      if (activeTab === "gmail" && focusedIndex > 0) {
        setFocusedIndex((prev) => prev - 1);
      }
    },
    "Cmd+Enter": () => {
      if (activeTab === "gmail" && emails?.[focusedIndex]) {
        setActiveMessageId(emails[focusedIndex].id);
        // Mark as read
        markRead.mutate({ id: emails[focusedIndex].id, read: true });
      }
    },
    "Cmd+Shift+E": () => {
      if (activeTab === "gmail" && emails?.[focusedIndex]) {
        archiveEmail.mutate({ id: emails[focusedIndex].id });
      }
    },
    "Cmd+Shift+U": () => {
      if (activeTab === "gmail" && emails?.[focusedIndex]) {
        // Toggle read/unread (since we don't have current read state readily in list, we toggle)
        markRead.mutate({ id: emails[focusedIndex].id, read: false });
        toast.info("Marked as unread");
      }
    },
    "Cmd+Alt+N": (e) => {
      e.preventDefault();
      setComposeOpen(true);
    },
    "Cmd+Alt+R": (e) => {
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
    "Cmd+Alt+I": () => setActiveTab("gmail"),
    "Cmd+Alt+C": () => setActiveTab("calendar"),
    "Cmd+Alt+S": () => setActiveTab("settings"),
    "Cmd+/": (e) => {
      e.preventDefault();
      setShortcutHelpOpen((prev) => !prev);
    },
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
    <div className="dashboard-root flex h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      {/* 1st Pane: Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        agentOpen={agentOpen}
        setAgentOpen={setAgentOpen}
        session={session}
        trialDaysRemaining={trialDaysRemaining}
      />

      {/* Main workspace (tabs) */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === "gmail" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Center column: AI Command Center OR Reading Pane */}
            {activeMessageId ? (
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Back to AI bar */}
                <div className="px-4 py-2 border-b border-zinc-900 flex items-center gap-2 shrink-0 bg-zinc-950">
                  <button
                    onClick={() => setActiveMessageId(null)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                    Back to AI
                  </button>
                </div>
                <ReadingPane
                  messageLoading={messageLoading}
                  selectedMessage={selectedMessage}
                  dailyBriefData={dailyBriefData}
                  createFollowUp={createFollowUp}
                  archiveEmail={archiveEmail}
                  showSnoozeDropdown={showSnoozeDropdown}
                  setShowSnoozeDropdown={setShowSnoozeDropdown}
                  snoozeEmail={snoozeEmail}
                  threadSummary={threadSummary}
                  summarizeThread={summarizeThread}
                  smartReplies={smartReplies}
                  replyBody={replyBody}
                  setReplyBody={setReplyBody}
                  replyToEmail={replyToEmail}
                  LoaderIcon={LoaderIcon}
                />
              </div>
            ) : (
              <CommandCenter onNavigate={(tab) => setActiveTab(tab)} />
            )}

            {/* Right panel: mini calendar + email list */}
            <div className="w-80 shrink-0 border-l border-zinc-900 flex flex-col overflow-hidden bg-zinc-950">
              <MiniCalendarWidget onNavigateToCalendar={() => setActiveTab("calendar")} />
              <EmailSidePanel
                onEmailClick={(id) => {
                  setActiveMessageId(id);
                  markRead.mutate({ id, read: true });
                }}
                activeMessageId={activeMessageId}
                gmailAuthError={gmailAuthError}
                onReconnect={() => signIn("google", { callbackUrl: "/" })}
              />
            </div>
          </div>
        )}

        {activeTab === "inbox" && (
          <div className="flex-1 flex overflow-hidden">
            <InboxList
              refreshInbox={refreshInbox}
              setComposeOpen={setComposeOpen}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              inboxTab={inboxTab}
              setInboxTab={setInboxTab}
              focusedIndex={focusedIndex}
              setFocusedIndex={setFocusedIndex}
              setActiveMessageId={setActiveMessageId}
              markRead={markRead}
              archiveEmail={archiveEmail}
              selectedEmailIds={selectedEmailIds}
              toggleEmailSelection={toggleEmailSelection}
              clearSelection={clearSelection}
              LoaderIcon={LoaderIcon}
              gmailAuthError={gmailAuthError}
              onReconnect={() => signIn("google", { callbackUrl: "/" })}
            />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {activeMessageId ? (
                <ReadingPane
                  messageLoading={messageLoading}
                  selectedMessage={selectedMessage}
                  dailyBriefData={dailyBriefData}
                  createFollowUp={createFollowUp}
                  archiveEmail={archiveEmail}
                  showSnoozeDropdown={showSnoozeDropdown}
                  setShowSnoozeDropdown={setShowSnoozeDropdown}
                  snoozeEmail={snoozeEmail}
                  threadSummary={threadSummary}
                  summarizeThread={summarizeThread}
                  smartReplies={smartReplies}
                  replyBody={replyBody}
                  setReplyBody={setReplyBody}
                  replyToEmail={replyToEmail}
                  LoaderIcon={LoaderIcon}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <Mail size={32} className="text-zinc-800 mb-3" />
                  <p className="text-sm font-medium text-zinc-600">Select an email to read</p>
                  <p className="text-xs text-zinc-700 mt-1">Click any message from the list on the left</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          /* Calendar Main View */
          <CalendarView
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            refreshEvents={refreshEvents}
            weekRange={weekRange}
            setCreateEventOpen={setCreateEventOpen}
            eventsLoading={eventsLoading}
            eventsFetching={eventsFetching}
            calendarError={eventsError ?? refreshEvents.error}
            onReconnect={() => signIn("google", { callbackUrl: "/" })}
            LoaderIcon={LoaderIcon}
            events={events ?? []}
            deleteEvent={deleteEvent}
          />
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
            <div className="space-y-3 max-h-75 overflow-y-auto custom-scrollbar pr-1">
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Move list focus down</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ↓" : "Ctrl+↓"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Move list focus up</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ↑" : "Ctrl+↑"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Open conversation</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ Enter" : "Ctrl+Enter"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Archive focused thread</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ⇧ E" : "Ctrl+Shift+E"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Mark thread as unread</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ⇧ U" : "Ctrl+Shift+U"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Compose new email</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ⌥ N" : "Ctrl+Alt+N"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Focus inline reply input</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ⌥ R" : "Ctrl+Alt+R"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Go to Inbox</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ⌥ I" : "Ctrl+Alt+I"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Go to Calendar</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ⌥ C" : "Ctrl+Alt+C"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Go to Settings</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ ⌥ S" : "Ctrl+Alt+S"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Toggle AI Copilot</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ I" : "Ctrl+I"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Open Command Palette</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ K" : "Ctrl+K"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Open Keyboard Shortcuts</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">{isMac ? "⌘ /" : "Ctrl+/"}</kbd>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-zinc-800">
                <span className="text-zinc-400">Close / Go Back</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-zinc-200">Esc</kbd>
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
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.endsWith(" ")) {
                      const regex = /\/([a-zA-Z0-9_-]+)\s$/;
                      const match = regex.exec(val);
                      if (match) {
                        const shortcut = match[1];
                        const template = templates?.find((t) => t.shortcut === shortcut);
                        if (template) {
                          val = val.replace(new RegExp(`/${shortcut}\\s$`), template.body + " ");
                          if (template.subject && !composeSubject) {
                            setComposeSubject(template.subject);
                          }
                        }
                      }
                    }
                    setComposeBody(val);
                  }}
                  rows={8}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <div className="relative">
                <button
                  onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition cursor-pointer text-xs font-semibold"
                >
                  Templates
                </button>
                {showTemplatesDropdown && (
                  <div className="absolute left-0 bottom-full mb-2 w-64 max-h-60 overflow-y-auto p-2 rounded-xl border border-zinc-850 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 text-left space-y-1">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 px-1">Insert Template</div>
                    {templates?.length === 0 && <div className="text-xs text-zinc-500 px-1 py-1">No templates found</div>}
                    {templates?.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          if (t.subject) setComposeSubject(t.subject);
                          setComposeBody(prev => prev ? prev + '\n\n' + t.body : t.body);
                          setShowTemplatesDropdown(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition cursor-pointer truncate"
                      >
                        {t.name} (/{t.shortcut})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
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
      </div>
      )}

      {/* Create Event Modal */}
      {createEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl relative space-y-4">
            <button
              onClick={closeCreateEventModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
            >
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-white">Create Calendar Event</h3>
            <div className="space-y-3 text-left">
              <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-3 space-y-2">
                <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-[0.18em]">
                  Plan with AI
                </label>
                <textarea
                  placeholder="Example: Create a Google Meet with jatin@example.com next Monday at 3pm for 45 minutes to discuss launch planning."
                  value={eventPrompt}
                  onChange={(e) => setEventPrompt(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-zinc-500">
                    Describe the event naturally and we&apos;ll fill the form for review.
                  </p>
                  <button
                    onClick={() => generateCalendarDraft.mutate({ prompt: eventPrompt })}
                    disabled={!eventPrompt.trim() || generateCalendarDraft.isPending}
                    className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {generateCalendarDraft.isPending ? "Drafting..." : "Generate Draft"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Event Title</label>
                <input
                  type="text"
                  placeholder="Team sync meeting"
                  value={eventSummary}
                  onChange={(e) => {
                    setEventSummary(e.target.value);
                    setEventErrors((prev) => ({ ...prev, summary: undefined }));
                  }}
                  aria-invalid={!!eventErrors.summary}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                />
                {eventErrors.summary ? (
                  <p className="mt-1 text-[11px] text-rose-400">{eventErrors.summary}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Start Time</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                    <input
                      type="date"
                      value={eventStartDate}
                      onChange={(e) => {
                        setEventStartDate(e.target.value);
                        setEventErrors((prev) => ({ ...prev, start: undefined }));
                      }}
                      aria-invalid={!!eventErrors.start}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                    />
                    <input
                      type="time"
                      value={eventStartTime}
                      onChange={(e) => {
                        setEventStartTime(e.target.value);
                        setEventErrors((prev) => ({ ...prev, start: undefined }));
                      }}
                      aria-invalid={!!eventErrors.start}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                    />
                  </div>
                  {eventErrors.start ? (
                    <p className="mt-1 text-[11px] text-rose-400">{eventErrors.start}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500">Shown in your local timezone.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">End Time</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                    <input
                      type="date"
                      value={eventEndDate}
                      onChange={(e) => {
                        setEventEndDate(e.target.value);
                        setEventErrors((prev) => ({ ...prev, end: undefined }));
                      }}
                      aria-invalid={!!eventErrors.end}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                    />
                    <input
                      type="time"
                      value={eventEndTime}
                      onChange={(e) => {
                        setEventEndTime(e.target.value);
                        setEventErrors((prev) => ({ ...prev, end: undefined }));
                      }}
                      aria-invalid={!!eventErrors.end}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                    />
                  </div>
                  {eventErrors.end ? (
                    <p className="mt-1 text-[11px] text-rose-400">{eventErrors.end}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500">Default duration is one hour.</p>
                  )}
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
                  onChange={(e) => {
                    setEventAttendees(e.target.value);
                    setEventErrors((prev) => ({ ...prev, attendees: undefined }));
                  }}
                  aria-invalid={!!eventErrors.attendees}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                />
                {eventErrors.attendees ? (
                  <p className="mt-1 text-[11px] text-rose-400">{eventErrors.attendees}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-zinc-500">Add one or more invitees separated by commas.</p>
                )}
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
                onClick={closeCreateEventModal}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitCreateEvent}
                disabled={sendInvite.isPending || generateCalendarDraft.isPending}
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

      {/* Interactive Shortcut Tutorial */}
      <ShortcutTutorial />
    </div>
  );
}

function SettingsView() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [settingsSubTab, setSettingsSubTab] = useState<"general" | "templates" | "automations" | "developer" | "suppression" | "billing" | "accounts">("general");
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
          onClick={() => setSettingsSubTab("templates")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "templates"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Templates
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
        <button
          onClick={() => setSettingsSubTab("billing")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "billing"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Billing
        </button>
        <button
          onClick={() => setSettingsSubTab("accounts")}
          className={`pb-3 border-b-2 transition cursor-pointer ${
            settingsSubTab === "accounts"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Accounts
        </button>
      </div>

      {settingsSubTab === "billing" && (
        <div className="max-w-3xl">
          <SubscriptionManager />
        </div>
      )}

      {settingsSubTab === "accounts" && (
        <div className="max-w-3xl">
          <ConnectedAccountsSettings />
        </div>
      )}

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
                  <span className="text-xs text-zinc-400 truncate max-w-20">gusion-mail.com/?ref=...</span>
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
                <div className="max-h-37.5 overflow-y-auto border border-zinc-855 rounded-lg divide-y divide-zinc-900">
                  {refStats.invites.map((invite) => (
                    <div key={invite.id} className="p-2.5 flex items-center justify-between text-xs bg-zinc-950/20">
                      <span className="text-zinc-300 font-medium truncate max-w-45">{invite.referredEmail}</span>
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
                <div className="space-y-2 max-h-55 overflow-y-auto">
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
                      <div className="flex items-center gap-2 shrink-0">
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
                <div className="space-y-2 max-h-55 overflow-y-auto">
                  {contactsData.map((contact) => (
                    <div key={contact.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-zinc-200 truncate">{contact.name ?? contact.email}</div>
                        {contact.name && (
                          <div className="text-[10px] text-zinc-550 truncate mt-0.5">{contact.email}</div>
                        )}
                        <div className="text-[9px] text-zinc-450 mt-1">
                          {contact.interactionCount} interactions
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                <div className="space-y-2 max-h-55 overflow-y-auto">
                  {orgMembersList.map((member) => (
                    <div key={member.id} className="p-3 rounded-lg border border-zinc-855 bg-zinc-950/40 flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-zinc-200 truncate">{member.name || member.email}</div>
                        <div className="text-[10px] text-zinc-550 truncate mt-0.5">{member.email}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {member.role === "owner" ? (
                          <span className="px-2 py-0.5 text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded capitalize font-medium">
                            Owner
                          </span>
                        ) : (activeOrg?.role === "owner" || activeOrg?.role === "admin") ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={member.role}
                              onChange={(e) => updateMemberRole.mutate({ memberId: member.id, role: e.target.value as "admin" | "member" })}
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
                      onChange={(e) => setOrgInviteRole(e.target.value as "admin" | "member")}
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
                onClick={() => checkoutSession.mutate()}
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

      {settingsSubTab === "templates" && <TemplatesSettingsView />}
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
