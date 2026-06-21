"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/trpc/react";
import { formatMessageDate, formatSender } from "@/app/_components/dashboard";
import { RefreshCw, ChevronDown, Mail, Loader2, WifiOff } from "lucide-react";

interface EmailSidePanelProps {
  onEmailClick: (id: string) => void;
  activeMessageId: string | null;
  gmailAuthError?: boolean;
  onReconnect?: () => void;
}

const PAGE_SIZE = 30;

export function EmailSidePanel({
  onEmailClick,
  activeMessageId,
  gmailAuthError,
  onReconnect,
}: EmailSidePanelProps) {
  const utils = api.useUtils();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetching,
  } = api.gmail.searchEmails.useQuery(
    { query: "", limit, tab: "all" },
    { retry: false, staleTime: 30000 }
  );
  const emails = data?.items ?? [];

  const refreshInbox = api.gmail.refreshInbox.useMutation({
    onSuccess: () => {
      void utils.gmail.searchEmails.invalidate();
    },
  });

  // Scroll to top when a new email is selected
  useEffect(() => {
    if (activeMessageId && listRef.current) {
      const el = listRef.current.querySelector(`[data-id="${activeMessageId}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeMessageId]);

  // More pages exist whenever Gmail returned a cursor for the next page.
  const hasMore = !!data?.nextCursor;

  if (gmailAuthError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center gap-3">
        <WifiOff size={20} className="text-zinc-600" />
        <p className="text-xs text-zinc-500">Gmail not connected</p>
        {onReconnect && (
          <button
            onClick={onReconnect}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer"
          >
            Reconnect Gmail
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Panel header */}
      <div className="px-4 py-2.5 border-b border-zinc-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Mail size={12} className="text-zinc-500" />
          <span className="text-[11px] font-semibold text-zinc-300">Inbox</span>
          {emails.length > 0 && (
            <span className="text-[9px] text-zinc-600 font-medium">({emails.length})</span>
          )}
        </div>
        <button
          onClick={() => refreshInbox.mutate()}
          disabled={refreshInbox.isPending || isFetching}
          className="p-1 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 rounded-md transition cursor-pointer disabled:opacity-50"
          title="Sync inbox"
        >
          <RefreshCw size={11} className={(refreshInbox.isPending || isFetching) ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Email list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="text-zinc-600 animate-spin" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Mail size={20} className="text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-600">No emails found</p>
          </div>
        ) : (
          <>
            {emails.map((email) => {
              const isActive = email.id === activeMessageId;
              const sender = formatSender(email.from);
              const initial = sender.charAt(0).toUpperCase();

              return (
                <button
                  key={email.id}
                  data-id={email.id}
                  onClick={() => onEmailClick(email.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-zinc-900/60 transition cursor-pointer group ${
                    isActive
                      ? "bg-indigo-600/10 border-l-2 border-l-indigo-500"
                      : "hover:bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700"
                      }`}
                    >
                      {initial}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Sender + date */}
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-[11px] font-semibold truncate ${
                            isActive ? "text-indigo-300" : "text-zinc-300"
                          }`}
                        >
                          {sender}
                        </span>
                        <span className="text-[10px] text-zinc-500 shrink-0">
                          {formatMessageDate(email.date)}
                        </span>
                      </div>

                      {/* Subject */}
                      <div
                        className={`text-[10px] truncate ${
                          isActive ? "text-zinc-300" : "text-zinc-500"
                        }`}
                      >
                        {email.subject || "(No Subject)"}
                      </div>

                      {/* Snippet */}
                      <div className="text-[9px] text-zinc-700 truncate mt-0.5 leading-tight">
                        {email.snippet}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                disabled={isFetching}
                className="w-full py-3 text-[10px] font-medium text-zinc-600 hover:text-zinc-300 flex items-center justify-center gap-1.5 transition cursor-pointer hover:bg-zinc-900/30 disabled:opacity-50"
              >
                {isFetching ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <ChevronDown size={11} />
                )}
                Load more emails
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
