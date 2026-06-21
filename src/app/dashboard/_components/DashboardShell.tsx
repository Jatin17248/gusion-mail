"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { X, HelpCircle } from "lucide-react";
import { useShortcuts } from "@/app/_hooks/use-shortcuts";
import { CommandPalette } from "@/app/_components/command-palette";
import { AgentDrawer } from "@/app/_components/agent-drawer";
import { ShortcutTutorial } from "@/app/_components/shortcut-tutorial";
import { Sidebar } from "@/app/_components/dashboard/sidebar";
import {
  ComposeModal,
  DRAFT_KEY,
  type ComposeInitial,
  type ComposePayload,
} from "@/app/_components/dashboard/compose-modal";
import { UpgradeModal } from "@/app/_components/dashboard/upgrade-modal";
import { DashboardContext } from "@/app/dashboard/_context/dashboard-context";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const router = useRouter();

  // Compose state — the form itself lives inside <ComposeModal>; the shell only
  // tracks open/prefill and orchestrates the send-with-undo window.
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | undefined>(undefined);

  // Upgrade / paywall modal
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);
  const openUpgrade = useCallback((reason?: string) => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  }, []);

  // Undo send state
  const [undoActive, setUndoActive] = useState(false);
  const [undoTimeoutId, setUndoTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Shortcut help modal
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);

  // Command palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Agent drawer
  const [agentOpen, setAgentOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(/Mac|iPod|iPad|iPhone/.test(window.navigator.userAgent));
    }
  }, []);

  // Templates query (needed for compose modal)
  const { data: templates } = api.template.listTemplates.useQuery();

  // Fetch user profile for trial calculation
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

  // Realtime WebSocket/SSE subscription
  useEffect(() => {
    let ws: WebSocket | null = null;
    let eventSource: EventSource | null = null;

    const handleMessage = (data: string) => {
      if (data === "connected" || data === "ping") return;
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;

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
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          handleMessage(typeof event.data === "string" ? event.data : "");
        };

        ws.onerror = () => {
          console.warn("WebSocket error, falling back to SSE");
          if (ws) ws.close();
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
        ws.onclose = null;
        ws.close();
      }
      if (eventSource) eventSource.close();
    };
  }, [utils, session?.user?.id]);

  // Email send mutations
  const sendEmail = api.gmail.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent!");
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to send."),
  });

  const scheduleSend = api.gmail.scheduleSend.useMutation({
    onSuccess: () => {
      toast.success("Email scheduled successfully!");
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to schedule send."),
  });

  const triggerSendEmail = useCallback(
    (payload: ComposePayload, sendAt?: Date) => {
      setComposeOpen(false);
      setComposeInitial(undefined);
      setUndoActive(true);

      const toastId = toast.info(
        sendAt
          ? `Scheduling send for ${sendAt.toLocaleString()}...`
          : "Sending email in 5s...",
        {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => handleUndoSend(payload),
          },
        }
      );

      const timeoutId = setTimeout(() => {
        if (sendAt) scheduleSend.mutate({ ...payload, sendAt });
        else sendEmail.mutate(payload);
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        setUndoActive(false);
        setUndoTimeoutId(null);
        toast.dismiss(toastId);
      }, 5000);

      setUndoTimeoutId(timeoutId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleSend, sendEmail]
  );

  const handleUndoSend = useCallback(
    (payload: ComposePayload) => {
      setUndoActive((active) => {
        if (!active) return false;
        setComposeInitial({
          to: payload.to,
          cc: payload.cc,
          bcc: payload.bcc,
          subject: payload.subject,
          body: payload.body,
          attachments: payload.attachments?.map((a) => ({ ...a, size: 0 })),
        });
        setComposeOpen(true);
        toast.success("Sending cancelled. Draft restored.");
        return false;
      });

      if (undoTimeoutId) {
        clearTimeout(undoTimeoutId);
        setUndoTimeoutId(null);
      }
    },
    [undoTimeoutId]
  );

  // Command palette navigation
  const handleCommandAction = useCallback(
    (action: string, payload?: string) => {
      switch (action) {
        case "search":
          if (payload) {
            router.push(`/dashboard/inbox?q=${encodeURIComponent(payload)}`);
          }
          break;
        case "inbox":
          router.push("/dashboard/inbox");
          break;
        case "calendar":
          router.push("/dashboard/calendar");
          break;
        case "settings":
          router.push("/dashboard/settings");
          break;
        case "agent":
          setAgentOpen(true);
          break;
        case "compose":
          setComposeOpen(true);
          break;
        case "help":
          setShortcutHelpOpen(true);
          break;
      }
    },
    [router]
  );

  // Global keyboard shortcuts
  useShortcuts({
    "Cmd+Alt+N": (e) => {
      e.preventDefault();
      setComposeOpen(true);
    },
    "Cmd+Alt+I": () => router.push("/dashboard/inbox"),
    "Cmd+Alt+C": () => router.push("/dashboard/calendar"),
    "Cmd+Alt+S": () => router.push("/dashboard/settings"),
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
    Escape: () => {
      setComposeOpen(false);
      setShortcutHelpOpen(false);
      setAgentOpen(false);
    },
  });

  return (
    <DashboardContext.Provider value={{ setComposeOpen, agentOpen, setAgentOpen, openUpgrade }}>
      <div className="dashboard-root flex h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
        <Sidebar
          agentOpen={agentOpen}
          setAgentOpen={setAgentOpen}
          session={session}
          trialDaysRemaining={trialDaysRemaining}
        />

        <main className="flex-1 flex overflow-hidden">
          {children}
        </main>

        {/* Floating help button */}
        <button
          onClick={() => setShortcutHelpOpen(true)}
          className="fixed bottom-4 right-4 p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded-full transition shadow-lg cursor-pointer"
          title="Keyboard Shortcuts"
        >
          <HelpCircle size={18} />
        </button>

        {/* Shortcut Help Modal */}
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
        <ComposeModal
          open={composeOpen}
          initial={composeInitial}
          sending={sendEmail.isPending || scheduleSend.isPending}
          templates={templates}
          onClose={() => {
            setComposeOpen(false);
            setComposeInitial(undefined);
          }}
          onSend={(payload) => triggerSendEmail(payload)}
          onScheduleSend={(payload, sendAt) => triggerSendEmail(payload, sendAt)}
        />

        {/* Upgrade / paywall modal */}
        <UpgradeModal
          open={upgradeOpen}
          reason={upgradeReason}
          onClose={() => setUpgradeOpen(false)}
        />

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
    </DashboardContext.Provider>
  );
}
