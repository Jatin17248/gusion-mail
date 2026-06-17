import { useState } from "react";
import {
  Sparkles,
  Mail,
  Bell,
  Archive,
  Clock,
  Send,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { ContactsSidePanel } from "@/app/_components/contacts-panel";
import { formatSender, parseEmailAddress } from "@/app/_components/dashboard";

interface ReadingPaneProps {
  messageLoading: boolean;
  selectedMessage: any;
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
  const [showFollowUpDropdown, setShowFollowUpDropdown] = useState(false);

  const followUpOptions = [
    { label: "1 day", days: 1 },
    { label: "2 days", days: 2 },
    { label: "3 days", days: 3 },
    { label: "1 week", days: 7 },
  ];

  return (
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
        <div className="flex-1 flex h-full overflow-hidden">
          <div className="flex-1 flex flex-col h-full border-r border-zinc-900">
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
            <div className="flex items-center gap-2 shrink-0 relative">
              <div className="relative">
                <button
                  onClick={() => setShowFollowUpDropdown(!showFollowUpDropdown)}
                  disabled={createFollowUp.isPending}
                  className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer disabled:opacity-50"
                  title="Set follow-up reminder"
                >
                  <Bell size={16} />
                </button>
                {showFollowUpDropdown && (
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
          
          {/* Contacts Side Panel */}
          <div className="w-80 shrink-0 flex flex-col h-full bg-zinc-950 border-l border-zinc-900">
            <ContactsSidePanel 
              email={parseEmailAddress(selectedMessage.from).email} 
              name={parseEmailAddress(selectedMessage.from).name} 
            />
          </div>
        </div>
      )}
    </section>
  );
}
