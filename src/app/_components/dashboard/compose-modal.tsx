"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { useDashboard } from "@/app/dashboard/_context/dashboard-context";
import {
  X,
  Send,
  Clock,
  Loader2,
  Paperclip,
  Sparkles,
  Minus,
  Maximize2,
  FileText,
} from "lucide-react";

export interface ComposeAttachment {
  filename: string;
  mimeType: string;
  data: string; // base64
  size: number;
}

export interface ComposeInitial {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  attachments?: ComposeAttachment[];
}

export interface ComposePayload {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: { filename: string; mimeType: string; data: string }[];
}

interface Template {
  id: string;
  name: string;
  shortcut: string;
  subject: string | null;
  body: string;
}

interface ComposeModalProps {
  open: boolean;
  initial?: ComposeInitial;
  sending?: boolean;
  templates?: Template[];
  onClose: () => void;
  onSend: (payload: ComposePayload) => void;
  onScheduleSend: (payload: ComposePayload, sendAt: Date) => void;
}

export const DRAFT_KEY = "gusion_compose_draft";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitAddresses(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A chip-style recipient editor: type an address, press Enter/comma to add. */
function RecipientField({
  label,
  chips,
  setChips,
  autoFocus,
  rightSlot,
}: {
  label: string;
  chips: string[];
  setChips: (next: string[]) => void;
  autoFocus?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const value = raw.trim().replace(/,$/, "").trim();
    if (!value) return;
    if (!chips.includes(value)) setChips([...chips, value]);
    setDraft("");
  };

  return (
    <div className="flex items-start gap-2 border-b border-zinc-800 py-1.5">
      <span className="text-xs font-semibold text-zinc-500 w-10 pt-1.5 shrink-0">{label}</span>
      <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[2rem]">
        {chips.map((chip) => {
          const valid = EMAIL_RE.test(chip);
          return (
            <span
              key={chip}
              className={`group flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                valid
                  ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                  : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
              }`}
              title={valid ? chip : "Invalid email address"}
            >
              {chip}
              <button
                type="button"
                onClick={() => setChips(chips.filter((c) => c !== chip))}
                className="opacity-60 hover:opacity-100"
              >
                <X size={11} />
              </button>
            </span>
          );
        })}
        <input
          autoFocus={autoFocus}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) commit(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") {
              if (draft.trim()) {
                e.preventDefault();
                commit(draft);
              }
            } else if (e.key === "Backspace" && !draft && chips.length) {
              setChips(chips.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={chips.length ? "" : "name@example.com"}
          className="flex-1 min-w-[8rem] bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none py-1"
        />
      </div>
      {rightSlot && <div className="pt-1 shrink-0">{rightSlot}</div>}
    </div>
  );
}

export function ComposeModal({
  open,
  initial,
  sending,
  templates,
  onClose,
  onSend,
  onScheduleSend,
}: ComposeModalProps) {
  const [toChips, setToChips] = useState<string[]>([]);
  const [ccChips, setCcChips] = useState<string[]>([]);
  const [bccChips, setBccChips] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSendLater, setShowSendLater] = useState(false);
  const [ghost, setGhost] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const wasOpen = useRef(false);
  const { openUpgrade } = useDashboard();

  const generateAiDraft = api.ai.aiCompose.useMutation({
    onSuccess: (res) => {
      setBody(res.body);
      if (res.subject && !subject) setSubject(res.subject);
      setAiPrompt("");
      setShowAi(false);
      toast.success("AI draft generated!");
    },
    onError: (err) => {
      if (err.message?.includes("premium")) {
        openUpgrade("AI compose is a Gusion Pro feature.");
      } else {
        toast.error(err.message || "Failed to generate draft.");
      }
    },
  });

  const autocomplete = api.ai.aiAutocomplete.useMutation({
    onSuccess: (res) => setGhost(res.completion ?? ""),
    onError: () => setGhost(""),
  });

  const saveDraft = api.gmail.createDraft.useMutation({
    onSuccess: () => {
      toast.success("Saved to Gmail Drafts");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      onClose();
    },
    onError: (err) => toast.error(err.message || "Failed to save draft."),
  });

  // Initialize on each open: prefer explicit `initial` (reply/undo), else
  // restore any locally-persisted draft.
  useEffect(() => {
    if (open && !wasOpen.current) {
      const hasInitial =
        [initial?.to, initial?.cc, initial?.subject, initial?.body].some(
          (v) => !!v?.trim(),
        ) || !!initial?.attachments?.length;
      if (hasInitial) {
        setToChips(splitAddresses(initial?.to));
        setCcChips(splitAddresses(initial?.cc));
        setBccChips(splitAddresses(initial?.bcc));
        setShowCc(!!initial?.cc);
        setShowBcc(!!initial?.bcc);
        setSubject(initial?.subject ?? "");
        setBody(initial?.body ?? "");
        setAttachments(initial?.attachments ?? []);
      } else {
        try {
          const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as
            | { to?: string[]; cc?: string[]; bcc?: string[]; subject?: string; body?: string }
            | null;
          setToChips(saved?.to ?? []);
          setCcChips(saved?.cc ?? []);
          setBccChips(saved?.bcc ?? []);
          setShowCc(!!saved?.cc?.length);
          setShowBcc(!!saved?.bcc?.length);
          setSubject(saved?.subject ?? "");
          setBody(saved?.body ?? "");
          setAttachments([]);
        } catch {
          // ignore malformed persisted draft
        }
      }
      setMinimized(false);
      setGhost("");
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Persist draft to localStorage as the user types (no Gmail API spam).
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      const empty = !toChips.length && !ccChips.length && !bccChips.length && !subject && !body;
      try {
        if (empty) localStorage.removeItem(DRAFT_KEY);
        else
          localStorage.setItem(
            DRAFT_KEY,
            JSON.stringify({ to: toChips, cc: ccChips, bcc: bccChips, subject, body }),
          );
      } catch {}
    }, 800);
    return () => clearTimeout(handle);
  }, [open, toChips, ccChips, bccChips, subject, body]);

  // Smart Compose: debounced ghost-text suggestion as the user writes.
  useEffect(() => {
    setGhost("");
    if (!open || body.trim().length < 12) return;
    const handle = setTimeout(() => {
      autocomplete.mutate({ body, subject });
    }, 700);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, open]);

  const buildPayload = (): ComposePayload => ({
    to: toChips.join(", "),
    cc: ccChips.length ? ccChips.join(", ") : undefined,
    bcc: bccChips.length ? bccChips.join(", ") : undefined,
    subject,
    body,
    attachments: attachments.length
      ? attachments.map((a) => ({ filename: a.filename, mimeType: a.mimeType, data: a.data }))
      : undefined,
  });

  const recipientsValid = toChips.length > 0 && toChips.every((c) => EMAIL_RE.test(c));
  const canSend = recipientsValid && !!subject && !!body && !sending;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.split(",")[1] ?? "";
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            data: base64,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const acceptGhost = () => {
    if (!ghost) return;
    setBody((prev) => prev + (prev.endsWith(" ") || !prev ? "" : " ") + ghost);
    setGhost("");
    bodyRef.current?.focus();
  };

  // Expand /shortcut templates inline as the user types in the body.
  const handleBodyChange = (raw: string) => {
    let val = raw;
    if (val.endsWith(" ")) {
      const match = /\/([a-zA-Z0-9_-]+)\s$/.exec(val);
      if (match) {
        const tpl = templates?.find((t) => t.shortcut === match[1]);
        if (tpl) {
          val = val.replace(new RegExp(`/${match[1]}\\s$`), tpl.body + " ");
          if (tpl.subject && !subject) setSubject(tpl.subject);
        }
      }
    }
    setBody(val);
  };

  const totalSize = useMemo(
    () => attachments.reduce((s, a) => s + a.size, 0),
    [attachments],
  );

  if (!open) return null;

  // Minimized pill in the bottom-right corner.
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl hover:bg-zinc-850 transition cursor-pointer"
      >
        <FileText size={14} className="text-indigo-400" />
        <span className="text-xs font-semibold text-zinc-200 max-w-[12rem] truncate">
          {subject || "New message"}
        </span>
        <Maximize2 size={13} className="text-zinc-500" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <h3 className="text-sm font-bold text-white">New Message</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(true)}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
              title="Minimize"
            >
              <Minus size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-4 py-2 overflow-y-auto custom-scrollbar">
          {/* Recipients */}
          <RecipientField
            label="To"
            chips={toChips}
            setChips={setToChips}
            autoFocus
            rightSlot={
              <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
                {!showCc && (
                  <button onClick={() => setShowCc(true)} className="hover:text-zinc-300">
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button onClick={() => setShowBcc(true)} className="hover:text-zinc-300">
                    Bcc
                  </button>
                )}
              </div>
            }
          />
          {showCc && <RecipientField label="Cc" chips={ccChips} setChips={setCcChips} />}
          {showBcc && <RecipientField label="Bcc" chips={bccChips} setChips={setBccChips} />}

          {/* Subject */}
          <div className="flex items-center gap-2 border-b border-zinc-800 py-1.5">
            <span className="text-xs font-semibold text-zinc-500 w-10 shrink-0">Subj</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none py-1"
            />
          </div>

          {/* AI compose */}
          {showAi && (
            <div className="mt-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-2">
              <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                ✨ Write with AI
              </label>
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && aiPrompt) generateAiDraft.mutate({ prompt: aiPrompt });
                  }}
                  placeholder="e.g. Friendly follow-up about the project budget..."
                  className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition"
                />
                <button
                  onClick={() => generateAiDraft.mutate({ prompt: aiPrompt })}
                  disabled={!aiPrompt || generateAiDraft.isPending}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  {generateAiDraft.isPending ? <Loader2 size={12} className="animate-spin" /> : "Draft"}
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && ghost) {
                e.preventDefault();
                acceptGhost();
              }
            }}
            placeholder="Write your email... (type /shortcut for templates)"
            rows={10}
            className="w-full mt-3 p-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-none leading-relaxed"
          />

          {/* Ghost-text suggestion */}
          {ghost && (
            <div className="flex items-start gap-2 -mt-1 mb-2 px-1 text-xs text-zinc-500">
              <Sparkles size={12} className="text-indigo-400 mt-0.5 shrink-0" />
              <span className="italic">
                {ghost}{" "}
                <button onClick={acceptGhost} className="not-italic font-semibold text-indigo-400 hover:underline">
                  Tab to accept
                </button>
              </span>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 py-2 border-t border-zinc-800/60">
              {attachments.map((att, i) => (
                <span
                  key={`${att.filename}-${i}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/60 border border-zinc-700/60 text-xs text-zinc-300"
                >
                  <Paperclip size={11} className="text-zinc-500" />
                  <span className="max-w-[12rem] truncate">{att.filename}</span>
                  <span className="text-[10px] text-zinc-500">{formatBytes(att.size)}</span>
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-zinc-500 hover:text-rose-400"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <span className="text-[10px] text-zinc-600 self-center">{formatBytes(totalSize)} total</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-zinc-800">
          <div className="flex items-center gap-1">
            {/* Send + Send Later */}
            <div className="relative flex items-center">
              <button
                onClick={() => onSend(buildPayload())}
                disabled={!canSend}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-l-lg transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 border-r border-indigo-500/30"
              >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                <span>Send</span>
              </button>
              <button
                onClick={() => setShowSendLater((v) => !v)}
                disabled={!canSend}
                className="px-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-r-lg transition cursor-pointer flex items-center justify-center disabled:opacity-50"
                title="Schedule send"
              >
                <Clock size={13} />
              </button>
              {showSendLater && (
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 text-left space-y-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">Schedule send</div>
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setHours(d.getHours() + 1);
                      onScheduleSend(buildPayload(), d);
                      setShowSendLater(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition flex justify-between cursor-pointer"
                  >
                    <span>In 1 hour</span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(Date.now() + 3600 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(8, 0, 0, 0);
                      onScheduleSend(buildPayload(), d);
                      setShowSendLater(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition flex justify-between cursor-pointer"
                  >
                    <span>Tomorrow morning</span>
                    <span className="text-[10px] text-zinc-500">8:00 AM</span>
                  </button>
                  <div className="border-t border-zinc-900 my-1" />
                  <label className="block text-[9px] text-zinc-500 font-semibold px-1">Custom date &amp; time</label>
                  <input
                    type="datetime-local"
                    onChange={(e) => {
                      if (e.target.value) {
                        onScheduleSend(buildPayload(), new Date(e.target.value));
                        setShowSendLater(false);
                      }
                    }}
                    className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              )}
            </div>

            {/* Attach */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
              title="Attach files"
            >
              <Paperclip size={15} />
            </button>

            {/* AI toggle */}
            <button
              onClick={() => setShowAi((v) => !v)}
              className={`p-2 rounded-lg transition cursor-pointer ${
                showAi ? "text-indigo-400 bg-indigo-500/10" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
              title="Write with AI"
            >
              <Sparkles size={15} />
            </button>

            {/* Templates */}
            <div className="relative">
              <button
                onClick={() => setShowTemplates((v) => !v)}
                className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                title="Insert template"
              >
                <FileText size={15} />
              </button>
              {showTemplates && (
                <div className="absolute left-0 bottom-full mb-2 w-64 max-h-60 overflow-y-auto p-2 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 text-left space-y-1">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 px-1">Insert Template</div>
                  {(!templates || templates.length === 0) && (
                    <div className="text-xs text-zinc-500 px-1 py-1">No templates found</div>
                  )}
                  {templates?.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (t.subject && !subject) setSubject(t.subject);
                        setBody((prev) => (prev ? prev + "\n\n" + t.body : t.body));
                        setShowTemplates(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition cursor-pointer truncate"
                    >
                      {t.name} <span className="text-zinc-600">/{t.shortcut}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!recipientsValid || !body) {
                  toast.error("Add a valid recipient and a message first.");
                  return;
                }
                saveDraft.mutate(buildPayload());
              }}
              disabled={saveDraft.isPending}
              className="px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Save to Gmail Drafts"
            >
              {saveDraft.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
              Save draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
