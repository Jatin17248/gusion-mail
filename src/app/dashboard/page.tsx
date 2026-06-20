"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CommandCenter } from "@/app/_components/dashboard/command-center";
import { ReadingPane } from "@/app/_components/dashboard/reading-pane";
import { MiniCalendarWidget } from "@/app/_components/dashboard/mini-calendar-widget";
import { EmailSidePanel } from "@/app/_components/dashboard/email-sidebar-panel";

function LoaderIcon() {
  return <Loader2 size={16} className="animate-spin text-zinc-500" />;
}

export default function DashboardPage() {
  const router = useRouter();

  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showSnoozeDropdown, setShowSnoozeDropdown] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [smartReplies, setSmartReplies] = useState<{ label: string; body: string }[]>([]);
  const [threadSummary, setThreadSummary] = useState<string | null>(null);
  const [gmailAuthError, setGmailAuthError] = useState(false);

  const utils = api.useUtils();

  const { data: dailyBriefData } = api.ai.aiDailyBrief.useQuery(undefined, {
    enabled: !activeMessageId,
    retry: false,
  });

  const { data: selectedMessage, isLoading: messageLoading } = api.gmail.getMessage.useQuery(
    { id: activeMessageId ?? "" },
    { enabled: !!activeMessageId }
  );

  const markRead = api.gmail.markRead.useMutation({
    onSuccess: () => {
      void utils.gmail.searchEmails.invalidate();
      if (activeMessageId) {
        void utils.gmail.getMessage.invalidate({ id: activeMessageId });
      }
    },
  });

  const archiveEmail = api.gmail.archiveEmail.useMutation({
    onMutate: async ({ id }) => {
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

  const snoozeEmail = api.gmail.snoozeEmail.useMutation({
    onSuccess: () => {
      toast.success("Email snoozed!");
      setActiveMessageId(null);
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to snooze email."),
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

  const createFollowUp = api.gmail.createFollowUp.useMutation({
    onSuccess: () => {
      toast.success("Follow-up reminder set for 2 days from now!");
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

  useEffect(() => {
    if (activeMessageId) {
      setThreadSummary(null);
      setSmartReplies([]);
      getSmartReplies.mutate({ messageId: activeMessageId });
    }
    // getSmartReplies intentionally excluded to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMessageId]);

  return (
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
        <CommandCenter
          onNavigate={(tab) => {
            switch (tab) {
              case "gmail":
                router.push("/dashboard");
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
              case "tickets":
                router.push("/dashboard/tickets");
                break;
              case "bulk":
                router.push("/dashboard/bulk");
                break;
            }
          }}
        />
      )}

      {/* Right panel: mini calendar + email list */}
      <div className="w-80 shrink-0 border-l border-zinc-900 flex flex-col overflow-hidden bg-zinc-950">
        <MiniCalendarWidget onNavigateToCalendar={() => router.push("/dashboard/calendar")} />
        <EmailSidePanel
          onEmailClick={(id) => {
            setActiveMessageId(id);
            markRead.mutate({ id, read: true });
          }}
          activeMessageId={activeMessageId}
          gmailAuthError={gmailAuthError}
          onReconnect={() => signIn("google", { callbackUrl: "/dashboard" })}
        />
      </div>
    </div>
  );
}
