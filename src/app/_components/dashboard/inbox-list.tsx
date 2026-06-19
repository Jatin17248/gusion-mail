"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Plus, RefreshCw, Star, WifiOff, Loader2 } from "lucide-react";
import { formatMessageDate, parseEmailAddress } from "@/app/_components/dashboard";
import { api } from "@/trpc/react";
import { toast } from "sonner";

const PAGE_SIZE = 50;

interface InboxListProps {
  refreshInbox: { mutate: () => void; isPending: boolean };
  setComposeOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inboxTab: "important" | "other" | "vip" | "all";
  setInboxTab: (tab: "important" | "other" | "vip" | "all") => void;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  setActiveMessageId: (id: string | null) => void;
  markRead: { mutate: (args: { id: string; read: boolean }) => void };
  archiveEmail: {
    mutate: (args: { id: string }) => void;
    mutateAsync: (args: { id: string }) => Promise<unknown>;
  };
  selectedEmailIds: Set<string>;
  toggleEmailSelection: (id: string) => void;
  clearSelection: () => void;
  LoaderIcon: React.FC;
  gmailAuthError?: boolean;
  onReconnect?: () => void;
}

export function InboxList({
  refreshInbox,
  setComposeOpen,
  searchQuery,
  setSearchQuery,
  inboxTab,
  setInboxTab,
  focusedIndex,
  setFocusedIndex,
  setActiveMessageId,
  markRead,
  archiveEmail,
  selectedEmailIds,
  toggleEmailSelection,
  clearSelection,
  gmailAuthError,
  onReconnect,
}: InboxListProps) {
  const utils = api.useUtils();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: emails = [], isLoading, isFetching } = api.gmail.searchEmails.useQuery(
    { query: searchQuery, limit, tab: inboxTab },
    { retry: false, staleTime: 30000 }
  );

  const createSavedSearch = api.search.createSavedSearch.useMutation({
    onSuccess: () => {
      toast.success("Search saved!");
      void utils.search.listSavedSearches.invalidate();
    },
    onError: () => toast.error("Failed to save search"),
  });

  // Reset limit when tab or search changes
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [inboxTab, searchQuery]);

  // Infinite scroll via IntersectionObserver on a sentinel div at the bottom
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetching && emails.length >= limit) {
          setLimit((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isFetching, emails.length, limit]);

  return (
    <section className="w-105 shrink-0 border-r border-zinc-900 flex flex-col bg-zinc-900/5">
      {/* Header */}
      <div className="p-4 border-b border-zinc-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-md font-semibold text-zinc-200">Inbox</h2>
            {emails.length > 0 && (
              <span className="text-[10px] text-zinc-600 font-medium">({emails.length})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshInbox.mutate()}
              disabled={refreshInbox.isPending}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer disabled:opacity-50"
              title="Sync Inbox"
            >
              <RefreshCw size={14} className={refreshInbox.isPending || isFetching ? "animate-spin" : ""} />
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

        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search mail (e.g. subject, body)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                try {
                  const existing = JSON.parse(localStorage.getItem("recent_searches") ?? "[]") as string[];
                  const updated = [searchQuery.trim(), ...existing.filter((s) => s !== searchQuery.trim())].slice(0, 10);
                  localStorage.setItem("recent_searches", JSON.stringify(updated));
                } catch {}
              }
            }}
            className="w-full pl-9 pr-10 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition"
          />
          {searchQuery.trim() && (
            <button
              onClick={() => createSavedSearch.mutate({ query: searchQuery.trim(), name: searchQuery.trim() })}
              disabled={createSavedSearch.isPending}
              className="absolute right-2.5 p-1 text-zinc-400 hover:text-yellow-400 transition"
              title="Save search"
            >
              <Star size={14} className={createSavedSearch.isPending ? "animate-pulse" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-900 px-2 bg-zinc-950/20 text-xs">
        {(["important", "other", "vip", "all"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setInboxTab(tab)}
            className={`flex-1 py-2.5 text-center border-b-2 font-medium transition cursor-pointer capitalize ${
              inboxTab === tab
                ? "border-indigo-500 text-indigo-400 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selectedEmailIds.size > 0 && (
        <div className="bg-indigo-600 px-4 py-2 flex items-center justify-between text-xs text-white shadow-lg sticky top-0 z-10">
          <span>{selectedEmailIds.size} selected</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const arr = Array.from(selectedEmailIds);
                void Promise.all(arr.map((id) => archiveEmail.mutateAsync({ id }))).then(() => {
                  clearSelection();
                  toast.success(`Archived ${arr.length} emails`);
                });
              }}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition font-medium"
            >
              Archive All
            </button>
            <button onClick={clearSelection} className="text-white/70 hover:text-white transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Email list */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/50">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
            <Loader2 size={18} className="animate-spin text-zinc-600" />
            <span className="text-xs">Loading inbox...</span>
          </div>
        ) : gmailAuthError ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3 px-6 text-center">
            <WifiOff size={20} className="text-zinc-600" />
            <span className="text-xs text-zinc-400">Google account disconnected.</span>
            <button
              onClick={onReconnect}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition cursor-pointer"
            >
              Reconnect Google
            </button>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <span className="text-xs">No emails found</span>
          </div>
        ) : (
          <>
            {emails.map((email, idx) => (
              <div
                key={email.id}
                onClick={() => {
                  setFocusedIndex(idx);
                  setActiveMessageId(email.id);
                  markRead.mutate({ id: email.id, read: true });
                }}
                className={`p-4 cursor-pointer text-left transition relative group ${
                  focusedIndex === idx
                    ? "bg-indigo-500/5 border-l-2 border-indigo-500"
                    : idx % 2 === 0
                    ? "bg-zinc-900/5"
                    : "bg-transparent"
                } hover:bg-zinc-900/20 ${selectedEmailIds.has(email.id) ? "bg-indigo-500/10" : ""}`}
              >
                <div className="absolute left-2 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <input
                    type="checkbox"
                    checked={selectedEmailIds.has(email.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleEmailSelection(email.id);
                    }}
                    className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div className={`transition-all ${selectedEmailIds.size > 0 || selectedEmailIds.has(email.id) ? "pl-5" : "group-hover:pl-5"}`}>
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
                    <span className="text-[10px] text-zinc-500 whitespace-nowrap shrink-0">
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
              </div>
            ))}

            {/* Infinite scroll sentinel + loading indicator */}
            <div ref={sentinelRef} className="py-4 flex items-center justify-center">
              {isFetching && (
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <Loader2 size={13} className="animate-spin" />
                  Loading more...
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
