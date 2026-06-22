import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Mail,
  Bell,
  Archive,
  Clock,
  Send,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Loader2,
  CalendarPlus,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { ContactsSidePanel } from "@/app/_components/contacts-panel";
import { formatSender, parseEmailAddress } from "@/app/_components/dashboard";

interface EmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** Track the app's dark/light theme (toggled via the `dark` class on <html>)
 * so the email canvas matches the rest of the UI instead of being forced light. */
function useIsDark() {
  // Default to dark — the app is dark-first, avoids a light flash on mount.
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function SafeHtmlRenderer({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState("200px");
  const isDark = useIsDark();

  useEffect(() => {
    const handleResize = () => {
      if (iframeRef.current?.contentWindow?.document?.body) {
        const doc = iframeRef.current.contentWindow.document;
        const body = doc.body;
        const htmlElement = doc.documentElement;
        
        // Calculate total content height
        const newHeight = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          htmlElement.clientHeight,
          htmlElement.scrollHeight,
          htmlElement.offsetHeight
        );
        setHeight(`${newHeight}px`);
      }
    };

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener("load", handleResize);

      // Trigger a resize check after styles/images settle
      const timer = setTimeout(handleResize, 150);

      let observer: MutationObserver | null = null;
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          observer = new MutationObserver(handleResize);
          observer.observe(doc.body, {
            attributes: true,
            childList: true,
            subtree: true,
          });
        }
      } catch (e) {
        console.warn("Could not setup MutationObserver on iframe:", e);
      }

      return () => {
        iframe.removeEventListener("load", handleResize);
        clearTimeout(timer);
        observer?.disconnect();
      };
    }
  }, [html, isDark]);

  // Keep the email's own markup intact (inline styles AND <style> blocks) so it
  // renders exactly like Gmail — only strip scripts. Stripping <style> before
  // was what collapsed rich emails (backgrounds, buttons, tables) into plain text.
  const sanitized = DOMPurify.sanitize(html, {
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["script"],
  });

  // The email body inherits the app theme as its default surface. Emails that
  // bring their own colors (the teal PSPCL card, buttons) override these, so we
  // get faithful rendering while plain emails blend into the dark UI.
  const theme = isDark
    ? { bg: "#09090b", text: "#e4e4e7", link: "#a5b4fc", border: "#27272a" }
    : { bg: "#ffffff", text: "#1f2937", link: "#4f46e5", border: "#e5e7eb" };

  const srcDocHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_blank">
        <meta name="color-scheme" content="${isDark ? "dark" : "light"}">
        <style>
          :root { color-scheme: ${isDark ? "dark" : "light"}; }
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: ${theme.text};
            background-color: ${theme.bg};
            word-wrap: break-word;
          }
          img {
            max-width: 100% !important;
            height: auto !important;
          }
          a {
            color: ${theme.link};
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        ${sanitized}
      </body>
    </html>
  `;

  return (
    <div
      className="w-full rounded-2xl border shadow-xl overflow-hidden"
      style={{ borderColor: theme.border, backgroundColor: theme.bg }}
    >
      <iframe
        ref={iframeRef}
        srcDoc={srcDocHtml}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{
          width: "100%",
          height,
          border: "none",
          backgroundColor: theme.bg,
          display: "block",
        }}
      />
    </div>
  );
}

/** Render the small Markdown subset our AI summaries/briefs emit (headings,
 * bold, italic, inline code, links, unordered lists). Styling is applied by the
 * wrapper via arbitrary variants; output is sanitized with DOMPurify. */
function renderMarkdownToHtml(md: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) => {
    let t = escapeHtml(s);
    t = t.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return t;
  };

  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of md.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    const bullet = /^[*\-•]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(bullet[1] ?? "")}</li>`);
      continue;
    }
    closeList();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      out.push(`<p><strong>${inline(heading[1] ?? "")}</strong></p>`);
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("");
}

function MarkdownText({ text, className }: { text: string; className?: string }) {
  const html = DOMPurify.sanitize(renderMarkdownToHtml(text), {
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["script", "style"],
  });
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Shared markdown styling (arbitrary variants survive Tailwind purge here).
const MARKDOWN_CLASS =
  "[&_p]:my-1 [&_strong]:font-semibold [&_strong]:text-zinc-100 [&_em]:italic " +
  "[&_a]:text-indigo-400 [&_a]:underline [&_a]:break-all " +
  "[&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.9em] " +
  "[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-0.5 [&_ul]:my-1 [&_li]:marker:text-zinc-600";

const PREVIEWABLE = (mime: string) =>
  mime === "application/pdf" || mime.startsWith("image/");

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function base64UrlToBlob(data: string, mimeType: string): Blob {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function AttachmentTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))
    return <ImageIcon size={16} className="text-indigo-400" />;
  if (mimeType === "application/pdf")
    return <FileText size={16} className="text-red-400" />;
  return <FileIcon size={16} className="text-zinc-400" />;
}

function AttachmentChip({
  messageId,
  attachment,
}: {
  messageId: string;
  attachment: EmailAttachment;
}) {
  const utils = api.useUtils();
  const [busy, setBusy] = useState(false);

  const handleOpen = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await utils.gmail.getAttachment.fetch({
        messageId,
        attachmentId: attachment.attachmentId,
      });
      if (!res.data) throw new Error("empty");
      const blob = base64UrlToBlob(res.data, attachment.mimeType);
      const url = URL.createObjectURL(blob);
      const download = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = attachment.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      if (PREVIEWABLE(attachment.mimeType)) {
        // PDFs / images open in a new tab for preview; fall back to a download
        // if the popup is blocked (e.g. Safari after the awaited fetch).
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) download();
      } else {
        download();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Couldn't load attachment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleOpen}
      disabled={busy}
      title={attachment.filename}
      className="group flex items-center gap-2.5 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 transition cursor-pointer max-w-[240px] disabled:opacity-60"
    >
      <span className="shrink-0">
        {busy ? (
          <Loader2 size={16} className="animate-spin text-zinc-500" />
        ) : (
          <AttachmentTypeIcon mimeType={attachment.mimeType} />
        )}
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-xs font-medium text-zinc-200 truncate">
          {attachment.filename}
        </span>
        {attachment.size > 0 && (
          <span className="block text-[10px] text-zinc-500">
            {formatBytes(attachment.size)}
          </span>
        )}
      </span>
      <Download
        size={13}
        className="shrink-0 ml-auto text-zinc-600 group-hover:text-zinc-300 transition"
      />
    </button>
  );
}

function AttachmentList({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: EmailAttachment[];
}) {
  if (!attachments?.length) return null;
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
        <Paperclip size={12} />
        {attachments.length} Attachment{attachments.length > 1 ? "s" : ""}
      </h4>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <AttachmentChip
            key={a.attachmentId}
            messageId={messageId}
            attachment={a}
          />
        ))}
      </div>
    </div>
  );
}

interface PreviewEmail {
  id: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  date: string | null;
}

interface ReadingPaneProps {
  messageLoading: boolean;
  selectedMessage: any;
  previewEmail?: PreviewEmail;
  dailyBriefData: any;
  createFollowUp: any;
  archiveEmail: any;
  showSnoozeDropdown: boolean;
  setShowSnoozeDropdown: (show: boolean) => void;
  snoozeEmail: any;
  threadSummary: string | null;
  summarizeThread: any;
  smartReplies: any[];
  replyBody: string;
  setReplyBody: (body: string) => void;
  replyToEmail: any;
  LoaderIcon: React.FC;
}

export function ReadingPane({
  messageLoading,
  selectedMessage,
  previewEmail,
  dailyBriefData,
  createFollowUp,
  archiveEmail,
  showSnoozeDropdown,
  setShowSnoozeDropdown,
  snoozeEmail,
  threadSummary,
  summarizeThread,
  smartReplies,
  replyBody,
  setReplyBody,
  replyToEmail,
  LoaderIcon,
}: ReadingPaneProps) {
  // Use full message if available, fall back to preview data while loading
  const displayEmail = selectedMessage ?? previewEmail;
  const [showFollowUpDropdown, setShowFollowUpDropdown] = useState(false);

  // One-click: turn this email into a tentative calendar event.
  const createCalendarEvent = api.calendar.createDraft.useMutation({
    onSuccess: () => toast.success("Added to your calendar as a tentative event."),
    onError: (err) => toast.error(err.message || "Failed to create event."),
  });

  const handleCreateEventFromEmail = () => {
    if (!displayEmail) return;
    // Default to the next half-hour slot, 30 minutes long.
    const start = new Date();
    start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    createCalendarEvent.mutate({
      summary: displayEmail.subject ?? "Follow up",
      description: `From email: ${formatSender(displayEmail.from)}\n\n${displayEmail.snippet ?? ""}`,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  };

  const followUpOptions = [
    { label: "1 day", days: 1 },
    { label: "2 days", days: 2 },
    { label: "3 days", days: 3 },
    { label: "1 week", days: 7 },
  ];

  return (
    <section className="flex-1 flex flex-col bg-zinc-950 overflow-hidden min-h-0">
      {/* Show full-screen spinner only when there's no preview data at all */}
      {messageLoading && !displayEmail ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <LoaderIcon />
          <span className="text-xs">Opening thread...</span>
        </div>
      ) : !displayEmail ? (
        <div className="flex-1 flex flex-col justify-start p-6 overflow-y-auto space-y-6">
          {/* Daily Brief Header */}
          <div className="p-5 rounded-2xl border border-zinc-900 bg-zinc-900/10 backdrop-blur-md relative overflow-hidden space-y-3">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400" />
              Your Daily Briefing
            </h3>
            {dailyBriefData?.brief ? (
              <MarkdownText
                text={dailyBriefData.brief}
                className={`text-xs text-zinc-400 leading-relaxed text-left font-medium ${MARKDOWN_CLASS}`}
              />
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
        <div className="flex-1 flex h-full overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col h-full border-r border-zinc-900 overflow-hidden min-h-0">
            {/* Reading Pane Header — shown immediately from preview data */}
            <div className="p-6 border-b border-zinc-900 flex justify-between items-start gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white mb-2 leading-snug">
                  {displayEmail.subject || "(No Subject)"}
                </h2>
                <div className="text-xs space-y-1">
                  <div className="text-zinc-400">
                    <span className="font-medium text-zinc-500">From: </span>
                    {formatSender(displayEmail.from)}
                  </div>
                  <div className="text-zinc-400">
                    <span className="font-medium text-zinc-500">To: </span>
                    {formatSender(displayEmail.to)}
                  </div>
                </div>
              </div>
            <div className="flex items-center gap-2 shrink-0 relative">
              <div className="relative">
                <button
                  onClick={() => setShowFollowUpDropdown(!showFollowUpDropdown)}
                  disabled={createFollowUp.isPending || !selectedMessage}
                  className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                  title="Set follow-up reminder"
                >
                  <Bell size={16} />
                </button>
                {showFollowUpDropdown && selectedMessage && (
                  <div className="absolute right-0 mt-2 w-48 p-2 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 text-left space-y-1">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 px-2">Remind if no reply</div>
                    {followUpOptions.map((opt) => (
                      <button
                        key={opt.days}
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + opt.days);
                          createFollowUp.mutate({
                            threadId: selectedMessage.threadId,
                            sentMessageId: selectedMessage.id,
                            remindAt: d,
                          });
                          setShowFollowUpDropdown(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition flex justify-between items-center cursor-pointer"
                      >
                        <span>{opt.label}</span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(Date.now() + opt.days * 86400000).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateEventFromEmail}
                disabled={createCalendarEvent.isPending || !displayEmail}
                className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                title="Create calendar event from this email"
              >
                {createCalendarEvent.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CalendarPlus size={16} />
                )}
              </button>

              <button
                onClick={() => archiveEmail.mutate({ id: displayEmail.id })}
                className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer"
                title="Archive Email (e)"
              >
                <Archive size={16} />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowSnoozeDropdown(!showSnoozeDropdown)}
                  disabled={!selectedMessage}
                  className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer disabled:opacity-40"
                  title="Snooze"
                >
                  <Clock size={16} />
                </button>
                {showSnoozeDropdown && selectedMessage && (
                  <div className="absolute right-0 mt-2 w-64 p-3 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 text-left space-y-2">
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
                      <span className="text-[10px] text-zinc-500">
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
                      <span className="text-[10px] text-zinc-500">8:00 AM</span>
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
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900/50 transition flex justify-between cursor-pointer"
                    >
                      <span>Next week</span>
                      <span className="text-[10px] text-zinc-500">Mon 8:00 AM</span>
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
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reading Pane Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 min-h-0">
            {messageLoading ? (
              /* Body skeleton — shown while full message loads, header already visible above */
              <div className="space-y-4 animate-pulse">
                <div className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5">
                  <div className="h-3 w-28 bg-indigo-900/40 rounded mb-3" />
                  <div className="h-3 w-full bg-zinc-800/60 rounded mb-2" />
                  <div className="h-3 w-4/5 bg-zinc-800/60 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-zinc-800/50 rounded" />
                  <div className="h-3 w-full bg-zinc-800/50 rounded" />
                  <div className="h-3 w-3/4 bg-zinc-800/50 rounded" />
                  <div className="h-3 w-full bg-zinc-800/40 rounded mt-4" />
                  <div className="h-3 w-5/6 bg-zinc-800/40 rounded" />
                  <div className="h-3 w-full bg-zinc-800/40 rounded" />
                  <div className="h-3 w-2/3 bg-zinc-800/30 rounded" />
                </div>
              </div>
            ) : (
              <>
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
                        className="px-2.5 py-1 text-[10px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/40 text-black dark:text-indigo-300 hover:text-white rounded transition cursor-pointer disabled:opacity-50"
                      >
                        {summarizeThread.isPending ? "Generating..." : "Generate Summary"}
                      </button>
                    )}
                  </div>
                  {threadSummary ? (
                    <MarkdownText
                      text={threadSummary}
                      className={`text-xs text-zinc-300 leading-relaxed ${MARKDOWN_CLASS}`}
                    />
                  ) : !summarizeThread.isPending ? (
                    <p className="text-[11px] text-zinc-500 italic">
                      Click above to generate a brief summary of this conversation.
                    </p>
                  ) : (
                    <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
                  )}
                </div>

                {/<[a-z][\s\S]*>/i.test(selectedMessage.body) ? (
                  <SafeHtmlRenderer html={selectedMessage.body} />
                ) : (
                  <div className="prose prose-invert max-w-none text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedMessage.body) }} />
                  </div>
                )}

                {selectedMessage.attachments?.length > 0 && (
                  <AttachmentList
                    messageId={selectedMessage.id}
                    attachments={selectedMessage.attachments}
                  />
                )}

                {/* Inline Reply Form */}
                <div className="pt-6 border-t border-zinc-900">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Quick Reply</h4>

                  {smartReplies.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {smartReplies.map((reply: any, index: number) => (
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
                          const inReplyTo = selectedMessage.messageId || selectedMessage.id;
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
              </>
            )}
          </div>
        </div>

        {/* Contacts Side Panel */}
        <div className="w-80 shrink-0 flex flex-col h-full bg-zinc-950 border-l border-zinc-900">
          <ContactsSidePanel
            email={parseEmailAddress(displayEmail.from).email}
            name={parseEmailAddress(displayEmail.from).name}
          />
        </div>
        </div>
      )}
    </section>
  );
}
