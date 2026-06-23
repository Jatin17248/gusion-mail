"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Star, WifiOff, Loader2, ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import { formatMessageDate, parseEmailAddress } from "@/app/_components/dashboard";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface Email {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  timestamp: number;
  priority?: string;
  category?: string;
}

interface InboxListProps {
  emails: Email[];
  isLoading: boolean;
  isFetching: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
  refreshInbox: { mutate: () => void; isPending: boolean };
  setComposeOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inboxTab: "primary" | "promotions" | "social" | "updates";
  setInboxTab: (tab: "primary" | "promotions" | "social" | "updates") => void;
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
  loadError?: boolean;
  onRetry?: () => void;
  onReconnect?: () => void;
  wrapperClassName?: string;
}

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-green-600",
  "bg-teal-600",
  "bg-blue-600",
  "bg-indigo-600",
  "bg-purple-600",
  "bg-pink-600",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function getInitial(from: string): string {
  const { name, email } = parseEmailAddress(from);
  const display = name || email;
  return (display[0] ?? "?").toUpperCase();
}

const TABS = [
  { id: "primary", label: "Primary" },
  { id: "promotions", label: "Promotions" },
  { id: "social", label: "Social" },
  { id: "updates", label: "Updates" },
] as const;

export function InboxList({
  emails,
  isLoading,
  isFetching,
  canLoadMore,
  onLoadMore,
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
  loadError,
  onRetry,
  onReconnect,
  wrapperClassName,
}: InboxListProps) {
  const utils = api.useUtils();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    }
  };

  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRowEnter = (id: string) => {
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => {
      void utils.gmail.getMessage.prefetch({ id });
    }, 200);
  };
  const handleRowLeave = () => {
    if (prefetchTimer.current) {
      clearTimeout(prefetchTimer.current);
      prefetchTimer.current = null;
    }
  };
  useEffect(() => () => {
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
  }, []);

  const createSavedSearch = api.search.createSavedSearch.useMutation({
    onSuccess: () => {
      toast.success("Search saved!");
      void utils.search.listSavedSearches.invalidate();
    },
    onError: () => toast.error("Failed to save search"),
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const canLoadMoreRef = useRef(canLoadMore);
  const isFetchingRef = useRef(isFetching);
  useEffect(() => { onLoadMoreRef.current = onLoadMore; }, [onLoadMore]);
  useEffect(() => { canLoadMoreRef.current = canLoadMore; }, [canLoadMore]);
  useEffect(() => { isFetchingRef.current = isFetching; }, [isFetching]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingRef.current && canLoadMoreRef.current) {
          onLoadMoreRef.current();
        }
      },
      { root, rootMargin: "800px", threshold: 0 }
    );

    observer.observe(sentinel);
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!canLoadMore || isFetching) return;
    const observer = observerRef.current;
    const sentinel = sentinelRef.current;
    if (!observer || !sentinel) return;
    observer.unobserve(sentinel);
    observer.observe(sentinel);
  }, [canLoadMore, isFetching]);

  return (
    <section className={wrapperClassName ?? "flex-1 overflow-hidden flex flex-col"}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 shrink-0">Inbox</h2>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search emails..."
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
            className="w-full pl-10 pr-10 py-2 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-full text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition"
          />
          {searchQuery.trim() && (
            <button
              onClick={() => createSavedSearch.mutate({ query: searchQuery.trim(), name: searchQuery.trim() })}
              disabled={createSavedSearch.isPending}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-yellow-500 transition"
              title="Save search"
            >
              <Star size={14} className={createSavedSearch.isPending ? "animate-pulse" : ""} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (focusedIndex > 0) setFocusedIndex(focusedIndex - 1);
            }}
            disabled={focusedIndex === 0}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-30"
            title="Previous email"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              if (focusedIndex < emails.length - 1) setFocusedIndex(focusedIndex + 1);
            }}
            disabled={focusedIndex >= emails.length - 1}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-30"
            title="Next email"
          >
            <ChevronRight size={16} />
          </button>
          {mounted && (
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInboxTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 font-medium transition cursor-pointer ${
              inboxTab === tab.id
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <span>{tab.label}</span>
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
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-2">
            <Loader2 size={18} className="animate-spin text-zinc-400" />
            <span className="text-xs">Loading inbox...</span>
          </div>
        ) : gmailAuthError ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-3 px-6 text-center">
            <WifiOff size={20} className="text-zinc-400" />
            <span className="text-xs text-zinc-500">Google account disconnected.</span>
            <button
              onClick={onReconnect}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition cursor-pointer"
            >
              Reconnect Google
            </button>
          </div>
        ) : loadError && emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-3 px-6 text-center">
            <WifiOff size={20} className="text-zinc-400" />
            <span className="text-xs text-zinc-500">Couldn&apos;t load your inbox.</span>
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-2">
            <span className="text-xs">No emails found</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-indigo-500 hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {emails.map((email, idx) => {
              const { name, email: addr } = parseEmailAddress(email.from);
              const displayName = name || addr;
              const avatarColor = getAvatarColor(displayName);
              const initial = getInitial(email.from);

              return (
                <div
                  key={email.id}
                  onMouseEnter={() => handleRowEnter(email.id)}
                  onMouseLeave={handleRowLeave}
                  onClick={() => {
                    setFocusedIndex(idx);
                    setActiveMessageId(email.id);
                    markRead.mutate({ id: email.id, read: true });
                  }}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer group transition relative ${
                    focusedIndex === idx
                      ? "bg-blue-50 dark:bg-indigo-500/8"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  } ${selectedEmailIds.has(email.id) ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}
                >
                  {/* Checkbox on hover */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                      selectedEmailIds.size > 0 || selectedEmailIds.has(email.id)
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}>
                      <input
                        type="checkbox"
                        checked={selectedEmailIds.has(email.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleEmailSelection(email.id);
                        }}
                        className="w-4 h-4 rounded border-zinc-300 bg-white dark:bg-zinc-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    {/* Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold ${avatarColor} ${
                        selectedEmailIds.size > 0 || selectedEmailIds.has(email.id)
                          ? "opacity-0"
                          : "group-hover:opacity-0"
                      } transition-opacity`}
                    >
                      {initial}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                        {displayName}
                      </span>
                      <span className="text-xs text-zinc-400 whitespace-nowrap shrink-0">
                        {formatMessageDate(email.date)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate mt-0.5">
                      {email.subject || "(No Subject)"}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                      {email.snippet}
                    </p>
                  </div>
                </div>
              );
            })}
          </>
        )}

        <div ref={sentinelRef} className="py-3 flex items-center justify-center min-h-10">
          {emails.length > 0 &&
            (isFetching ? (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 size={13} className="animate-spin" />
                Loading more...
              </div>
            ) : !canLoadMore ? (
              <span className="text-[10px] text-zinc-400">All caught up</span>
            ) : null)}
        </div>
      </div>
    </section>
  );
}
