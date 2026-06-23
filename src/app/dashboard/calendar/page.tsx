"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Send, X, Loader2 } from "lucide-react";
import { CalendarView } from "@/app/_components/dashboard/calendar-view";

function LoaderIcon() {
  return <Loader2 size={16} className="animate-spin text-zinc-500" />;
}

type EventFormErrors = Partial<Record<"summary" | "start" | "end" | "attendees", string>>;

const EVENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function formatTimeInputValue(date: Date) {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function buildDateTimeFromParts(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (!year || !month || !day || hours === undefined || minutes === undefined) return null;
  const result = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

function getDefaultEventDateTimes() {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
  if (start.getMinutes() === 0 && start.getSeconds() === 0) {
    start.setHours(start.getHours() + 1);
  }
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    startDate: formatDateInputValue(start),
    startTime: formatTimeInputValue(start),
    endDate: formatDateInputValue(end),
    endTime: formatTimeInputValue(end),
  };
}

function applyIsoDateTimeToFields(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { date: formatDateInputValue(date), time: formatTimeInputValue(date) };
}

function parseAttendeeEmails(input: string) {
  return input.split(",").map((item) => item.trim()).filter(Boolean);
}

function CalendarPageInner() {
  const utils = api.useUtils();
  const searchParams = useSearchParams();

  const initialWeekOffset = useMemo(() => {
    const dateParam = searchParams.get("date");
    if (!dateParam) return 0;
    const target = new Date(dateParam);
    if (isNaN(target.getTime())) return 0;
    const now = new Date();
    const nowSunday = new Date(now);
    nowSunday.setDate(now.getDate() - now.getDay());
    nowSunday.setHours(0, 0, 0, 0);
    const targetSunday = new Date(target);
    targetSunday.setDate(target.getDate() - target.getDay());
    targetSunday.setHours(0, 0, 0, 0);
    return Math.round((targetSunday.getTime() - nowSunday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }, [searchParams]);

  const [monthOffset, setMonthOffset] = useState(initialWeekOffset);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [eventSummary, setEventSummary] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventLoc, setEventLoc] = useState("");
  const [eventPrompt, setEventPrompt] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventAttendees, setEventAttendees] = useState("");
  const [eventErrors, setEventErrors] = useState<EventFormErrors>({});

  const weekRange = useMemo(() => {
    const today = new Date();
    const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    // Start at the Sunday on or before the 1st of the month
    const startDow = displayDate.getDay();
    const start = new Date(displayDate.getFullYear(), displayDate.getMonth(), 1 - startDow);
    start.setHours(0, 0, 0, 0);
    // Cover 6 full weeks (42 days)
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [monthOffset]);

  const { data: events, isLoading: eventsLoading, isFetching: eventsFetching, error: eventsError } =
    api.calendar.searchEvents.useQuery(
      { query: "", weekStart: weekRange.start, weekEnd: weekRange.end },
      { retry: false }
    );

  const refreshEvents = api.calendar.refreshEvents.useMutation({
    onSuccess: (res) => {
      toast.success(`Synced ${res.synced} events.`);
      void utils.calendar.searchEvents.invalidate();
    },
    onError: (err) => toast.error(err.message || "Sync failed."),
  });

  const sendInvite = api.calendar.sendInvite.useMutation({
    onSuccess: () => {
      toast.success("Calendar invite sent!");
      closeCreateEventModal();
      void utils.calendar.searchEvents.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to create event."),
  });

  const generateCalendarDraft = api.ai.aiCalendarAssist.useMutation({
    onSuccess: (draft) => {
      const startParts = applyIsoDateTimeToFields(draft.start);
      const endParts = applyIsoDateTimeToFields(draft.end);
      setEventSummary(draft.summary);
      setEventDesc(draft.description ?? "");
      setEventLoc(draft.location ?? "");
      setEventAttendees((draft.attendees ?? []).join(", "));
      if (startParts) {
        setEventStartDate(startParts.date);
        setEventStartTime(startParts.time);
      }
      if (endParts) {
        setEventEndDate(endParts.date);
        setEventEndTime(endParts.time);
      }
      setEventErrors({});
      toast.success("Drafted event details from your prompt.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate event draft.");
    },
  });

  const deleteEvent = api.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      toast.success("Event deleted.");
      void utils.calendar.searchEvents.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete event."),
  });

  const syncedCalendarMonths = useRef(new Set<string>());

  useEffect(() => {
    const monthKey = `${weekRange.start}:${weekRange.end}`;
    if (syncedCalendarMonths.current.has(monthKey)) return;
    syncedCalendarMonths.current.add(monthKey);
    refreshEvents.mutate({ weekStart: weekRange.start, weekEnd: weekRange.end });
  }, [weekRange.start, weekRange.end]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set default date/time values when modal opens
  useEffect(() => {
    if (!createEventOpen) return;
    setEventErrors({});
    if (eventStartDate || eventStartTime || eventEndDate || eventEndTime) return;
    const defaults = getDefaultEventDateTimes();
    setEventStartDate(defaults.startDate);
    setEventStartTime(defaults.startTime);
    setEventEndDate(defaults.endDate);
    setEventEndTime(defaults.endTime);
  }, [createEventOpen, eventStartDate, eventStartTime, eventEndDate, eventEndTime]);

  const closeCreateEventModal = () => {
    setCreateEventOpen(false);
    setEventPrompt("");
    setEventErrors({});
    setEventSummary("");
    setEventDesc("");
    setEventLoc("");
    setEventStartDate("");
    setEventStartTime("");
    setEventEndDate("");
    setEventEndTime("");
    setEventAttendees("");
  };

  const submitCreateEvent = () => {
    const nextErrors: EventFormErrors = {};
    const trimmedSummary = eventSummary.trim();
    const trimmedLocation = eventLoc.trim();
    const trimmedDescription = eventDesc.trim();
    const attendeesList = parseAttendeeEmails(eventAttendees);
    const invalidAttendees = attendeesList.filter((email) => !EVENT_EMAIL_RE.test(email));
    const startAt = buildDateTimeFromParts(eventStartDate, eventStartTime);
    const endAt = buildDateTimeFromParts(eventEndDate, eventEndTime);

    if (!trimmedSummary) nextErrors.summary = "Add a clear event title.";
    if (!startAt) nextErrors.start = "Choose a valid start date and time.";
    if (!endAt) nextErrors.end = "Choose a valid end date and time.";
    if (startAt && endAt && endAt <= startAt) nextErrors.end = "End time must be after the start time.";
    if (invalidAttendees.length > 0) {
      nextErrors.attendees = `Fix invalid email${invalidAttendees.length > 1 ? "s" : ""}: ${invalidAttendees.join(", ")}`;
    }

    setEventErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !startAt || !endAt) return;

    sendInvite.mutate({
      summary: trimmedSummary,
      description: trimmedDescription || undefined,
      location: trimmedLocation || undefined,
      start: startAt.toISOString(),
      end: endAt.toISOString(),
      attendees: attendeesList,
    });
  };

  return (
    <>
      <CalendarView
        monthOffset={monthOffset}
        setMonthOffset={setMonthOffset}
        refreshEvents={refreshEvents}
        setCreateEventOpen={setCreateEventOpen}
        eventsLoading={eventsLoading}
        eventsFetching={eventsFetching}
        calendarError={eventsError ?? refreshEvents.error}
        onReconnect={() => signIn("google", { callbackUrl: "/dashboard" })}
        LoaderIcon={LoaderIcon}
        events={events ?? []}
        deleteEvent={deleteEvent}
      />

      {/* Create Event Modal */}
      {createEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl relative space-y-4">
            <button
              onClick={closeCreateEventModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
            >
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-white">Create Calendar Event</h3>
            <div className="space-y-3 text-left">
              <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-3 space-y-2">
                <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-[0.18em]">
                  Plan with AI
                </label>
                <textarea
                  placeholder="Example: Create a Google Meet with jatin@example.com next Monday at 3pm for 45 minutes to discuss launch planning."
                  value={eventPrompt}
                  onChange={(e) => setEventPrompt(e.target.value)}
                  rows={3}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-zinc-500">
                    Describe the event naturally and we&apos;ll fill the form for review.
                  </p>
                  <button
                    onClick={() => generateCalendarDraft.mutate({ prompt: eventPrompt })}
                    disabled={!eventPrompt.trim() || generateCalendarDraft.isPending}
                    className="px-3 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {generateCalendarDraft.isPending ? "Drafting..." : "Generate Draft"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Event Title</label>
                <input
                  type="text"
                  placeholder="Team sync meeting"
                  value={eventSummary}
                  onChange={(e) => {
                    setEventSummary(e.target.value);
                    setEventErrors((prev) => ({ ...prev, summary: undefined }));
                  }}
                  aria-invalid={!!eventErrors.summary}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                />
                {eventErrors.summary ? (
                  <p className="mt-1 text-[11px] text-rose-400">{eventErrors.summary}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Start Time</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                    <input
                      type="date"
                      value={eventStartDate}
                      onChange={(e) => {
                        setEventStartDate(e.target.value);
                        setEventErrors((prev) => ({ ...prev, start: undefined }));
                      }}
                      aria-invalid={!!eventErrors.start}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                    />
                    <input
                      type="time"
                      value={eventStartTime}
                      onChange={(e) => {
                        setEventStartTime(e.target.value);
                        setEventErrors((prev) => ({ ...prev, start: undefined }));
                      }}
                      aria-invalid={!!eventErrors.start}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                    />
                  </div>
                  {eventErrors.start ? (
                    <p className="mt-1 text-[11px] text-rose-400">{eventErrors.start}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500">Shown in your local timezone.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">End Time</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                    <input
                      type="date"
                      value={eventEndDate}
                      onChange={(e) => {
                        setEventEndDate(e.target.value);
                        setEventErrors((prev) => ({ ...prev, end: undefined }));
                      }}
                      aria-invalid={!!eventErrors.end}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                    />
                    <input
                      type="time"
                      value={eventEndTime}
                      onChange={(e) => {
                        setEventEndTime(e.target.value);
                        setEventErrors((prev) => ({ ...prev, end: undefined }));
                      }}
                      aria-invalid={!!eventErrors.end}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                    />
                  </div>
                  {eventErrors.end ? (
                    <p className="mt-1 text-[11px] text-rose-400">{eventErrors.end}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500">Default duration is one hour.</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Location</label>
                <input
                  type="text"
                  placeholder="Google Meet or office address"
                  value={eventLoc}
                  onChange={(e) => setEventLoc(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Attendees (comma separated emails)</label>
                <input
                  type="text"
                  placeholder="guest1@example.com, guest2@example.com"
                  value={eventAttendees}
                  onChange={(e) => {
                    setEventAttendees(e.target.value);
                    setEventErrors((prev) => ({ ...prev, attendees: undefined }));
                  }}
                  aria-invalid={!!eventErrors.attendees}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition aria-invalid:border-rose-500"
                />
                {eventErrors.attendees ? (
                  <p className="mt-1 text-[11px] text-rose-400">{eventErrors.attendees}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-zinc-500">Add one or more invitees separated by commas.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Description</label>
                <textarea
                  placeholder="Agenda points or description..."
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  rows={4}
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeCreateEventModal}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitCreateEvent}
                disabled={sendInvite.isPending || generateCalendarDraft.isPending}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
              >
                <span>Create & Invite</span>
                <Send size={10} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarPageInner />
    </Suspense>
  );
}
