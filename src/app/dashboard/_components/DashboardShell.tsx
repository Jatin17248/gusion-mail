"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import {
  X,
  HelpCircle,
  Send,
  Clock,
  Loader2,
} from "lucide-react";
import { useShortcuts } from "@/app/_hooks/use-shortcuts";
import { CommandPalette } from "@/app/_components/command-palette";
import { AgentDrawer } from "@/app/_components/agent-drawer";
import { ShortcutTutorial } from "@/app/_components/shortcut-tutorial";
import { Sidebar } from "@/app/_components/dashboard/sidebar";
import { DashboardContext } from "@/app/dashboard/_context/dashboard-context";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const router = useRouter();

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [aiComposePrompt, setAiComposePrompt] = useState("");
  const [showSendLaterDropdown, setShowSendLaterDropdown] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);

  // Undo send state
  const [undoActive, setUndoActive] = useState(false);
  const [, setUndoDraft] = useState<{ to: string; subject: string; body: string; sendAt?: Date } | null>(null);
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
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to send."),
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

  const triggerSendEmail = useCallback(
    (to: string, subject: string, body: string, sendAt?: Date) => {
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
              handleUndoSend(to, subject, body);
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleSend, sendEmail]
  );

  const handleUndoSend = useCallback(
    (to: string, subject: string, body: string) => {
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
    <DashboardContext.Provider value={{ setComposeOpen, agentOpen, setAgentOpen }}>
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
                      {generateAiDraft.isPending ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Drafting...
                        </>
                      ) : (
                        "Draft"
                      )}
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
                      {templates?.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            if (t.subject) setComposeSubject(t.subject);
                            setComposeBody((prev) => (prev ? prev + "\n\n" + t.body : t.body));
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
                            {new Date(Date.now() + 3600 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
