"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { InboxList } from "@/app/_components/dashboard/inbox-list";
import { ReadingPane } from "@/app/_components/dashboard/reading-pane";
import { useDashboard } from "@/app/dashboard/_context/dashboard-context";
import { useShortcuts } from "@/app/_hooks/use-shortcuts";

const PAGE_SIZE = 25;

function LoaderIcon() {
  return <Loader2 size={16} className="animate-spin text-zinc-500" />;
}

export default function InboxPage() {
  const searchParams = useSearchParams();
  const { setComposeOpen } = useDashboard();
  const utils = api.useUtils();

  const initialMsg = searchParams.get("msg");

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [inboxTab, setInboxTab] = useState<"important" | "other" | "vip" | "all">("all");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(initialMsg);
  const [showSnoozeDropdown, setShowSnoozeDropdown] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [smartReplies, setSmartReplies] = useState<{ label: string; body: string }[]>([]);
  const [threadSummary, setThreadSummary] = useState<string | null>(null);
  const [gmailAuthError, setGmailAuthError] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const toggleEmailSelection = (id: string) => {
    setSelectedEmailIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const clearSelection = () => setSelectedEmailIds(new Set());

  // Cursor-based infinite pagination against Gmail. The query input omits
  // `cursor` — tRPC injects it from getNextPageParam for each page.
  const queryInput = { query: debouncedSearch, limit: PAGE_SIZE, tab: inboxTab };
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: emailsLoading,
    isFetching,
  } = api.gmail.searchEmails.useInfiniteQuery(queryInput, {
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const emails = data?.pages.flatMap((p) => p.items) ?? [];
  const hasMore = !!hasNextPage;

  const onLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Re-fetch from page 1 (called after mutations that change inbox membership).
  const resetAndRefresh = useCallback(() => {
    void utils.gmail.searchEmails.invalidate();
  }, [utils.gmail.searchEmails]);

  const { data: selectedMessage, isLoading: messageLoading } = api.gmail.getMessage.useQuery(
    { id: activeMessageId ?? "" },
    { enabled: !!activeMessageId, retry: false }
  );

  const { data: dailyBriefData } = api.ai.aiDailyBrief.useQuery(undefined, {
    enabled: !activeMessageId,
    retry: false,
  });

  const refreshInbox = api.gmail.refreshInbox.useMutation({
    onSuccess: (res) => {
      if (res.synced > 0) toast.success(`Synced ${res.synced} emails.`);
      resetAndRefresh();
    },
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        setGmailAuthError(true);
      } else {
        toast.error("Sync failed.");
      }
    },
  });

  const markRead = api.gmail.markRead.useMutation({
    onSuccess: () => {
      // Only invalidate the message detail; don't reset the inbox list for read-state changes
      if (activeMessageId) {
        void utils.gmail.getMessage.invalidate({ id: activeMessageId });
      }
    },
  });

  const archiveEmail = api.gmail.archiveEmail.useMutation({
    onMutate: ({ id }) => {
      toast.info("Archived message", {
        action: {
          label: "Undo",
          onClick: () => toast.info("Undo not supported in preview"),
        },
      });
      if (activeMessageId === id) {
        setActiveMessageId(null);
      }
      // Optimistically remove from every cached page immediately.
      utils.gmail.searchEmails.setInfiniteData(queryInput, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                items: p.items.filter((e) => e.id !== id),
              })),
            }
          : old,
      );
    },
    onSuccess: () => {
      resetAndRefresh();
    },
  });

  const snoozeEmail = api.gmail.snoozeEmail.useMutation({
    onSuccess: () => {
      toast.success("Email snoozed!");
      setActiveMessageId(null);
      resetAndRefresh();
    },
    onError: (err) => toast.error(err.message || "Failed to snooze email."),
  });

  const replyToEmail = api.gmail.replyToEmail.useMutation({
    onSuccess: () => {
      toast.success("Reply sent!");
      setReplyBody("");
      if (activeMessageId) {
        void utils.gmail.getMessage.invalidate({ id: activeMessageId });
      }
    },
    onError: (err) => toast.error(err.message || "Failed to send reply."),
  });

  const createFollowUp = api.gmail.createFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Follow-up reminder set!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to set follow-up reminder.");
    },
  });

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

  // Auto-sync on first load when inbox is empty
  const hasAutoSynced = useRef(false);
  useEffect(() => {
    if (!emailsLoading && emails.length === 0 && !hasAutoSynced.current) {
      hasAutoSynced.current = true;
      refreshInbox.mutate();
    }
  }, [emailsLoading, emails]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart replies when message changes
  useEffect(() => {
    if (activeMessageId) {
      setThreadSummary(null);
      setSmartReplies([]);
      getSmartReplies.mutate({ messageId: activeMessageId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMessageId]);

  // Reset focused index when the visible list changes (tab/search switch)
  useEffect(() => {
    setFocusedIndex(0);
  }, [debouncedSearch, inboxTab]);

  // Keyboard shortcuts — operate on the same emails array that InboxList renders
  useShortcuts({
    "Cmd+ArrowDown": () => {
      if (focusedIndex < emails.length - 1) {
        setFocusedIndex((prev) => prev + 1);
      }
    },
    "Cmd+ArrowUp": () => {
      if (focusedIndex > 0) {
        setFocusedIndex((prev) => prev - 1);
      }
    },
    "Cmd+Enter": () => {
      const email = emails[focusedIndex];
      if (email) {
        setActiveMessageId(email.id);
        markRead.mutate({ id: email.id, read: true });
      }
    },
    "Cmd+Shift+E": () => {
      const email = emails[focusedIndex];
      if (email) archiveEmail.mutate({ id: email.id });
    },
    "Cmd+Shift+U": () => {
      const email = emails[focusedIndex];
      if (email) {
        markRead.mutate({ id: email.id, read: false });
        toast.info("Marked as unread");
      }
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
    },
  });

  return (
    <div className="flex-1 flex overflow-hidden">
      <InboxList
        emails={emails}
        isLoading={emailsLoading}
        isFetching={isFetching}
        canLoadMore={hasMore}
        onLoadMore={onLoadMore}
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
        onReconnect={() => signIn("google", { callbackUrl: "/dashboard" })}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {activeMessageId ? (
          <ReadingPane
            messageLoading={messageLoading}
            selectedMessage={selectedMessage}
            previewEmail={emails.find((e) => e.id === activeMessageId)}
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
            <Mail size={32} className="text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-400">Select an email to read</p>
            <p className="text-xs text-zinc-500 mt-1">Click any message from the list on the left</p>
          </div>
        )}
      </div>
    </div>
  );
}
