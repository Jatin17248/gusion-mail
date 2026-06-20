import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users2,
} from "lucide-react";
import { formatEventWhen, parseEmailAddress } from "@/lib/display";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  status: string;
  start: string;
  end: string;
  attendees: string[];
  htmlLink: string;
  timestamp: number;
}

interface CalendarViewProps {
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  refreshEvents: any;
  weekRange: { start: string; end: string };
  setCreateEventOpen: (open: boolean) => void;
  eventsLoading: boolean;
  eventsFetching: boolean;
  calendarError?: { message?: string } | null;
  onReconnect: () => void;
  LoaderIcon: React.FC;
  events: CalendarEvent[];
  deleteEvent: any;
}

function parseCalendarDate(value: string) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year!, (month ?? 1) - 1, day ?? 1);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAllDayEvent(event: CalendarEvent) {
  return /^\d{4}-\d{2}-\d{2}$/.test(event.start);
}

function formatShortTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWeekRangeLabel(weekRange: { start: string; end: string }) {
  const startDate = parseCalendarDate(weekRange.start);
  const endDate = parseCalendarDate(weekRange.end);
  if (!startDate || !endDate) return "This week";

  const displayEnd = new Date(endDate);
  displayEnd.setDate(displayEnd.getDate() - 1);

  const sameMonth = startDate.getMonth() === displayEnd.getMonth();
  const startLabel = startDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  const endLabel = displayEnd.toLocaleDateString([], {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

function getAttendeeSummary(attendees: string[]) {
  if (attendees.length === 0) return "No guests";

  const names = attendees.slice(0, 2).map((attendee) => {
    const { name, email } = parseEmailAddress(attendee);
    return name || email || attendee;
  });

  if (attendees.length <= 2) return names.join(", ");
  return `${names.join(", ")} +${attendees.length - 2}`;
}

function getEventChipLabel(event: CalendarEvent, dayDate: Date) {
  if (isAllDayEvent(event)) return "All day";

  const startDate = parseCalendarDate(event.start);
  const endDate = parseCalendarDate(event.end);
  if (!startDate) return "Scheduled";

  const currentDayKey = toDayKey(dayDate);
  const startDayKey = toDayKey(startDate);
  const endDayKey = endDate ? toDayKey(endDate) : startDayKey;

  if (startDayKey === currentDayKey && endDate && endDayKey === currentDayKey) {
    return `${formatShortTime(startDate)} - ${formatShortTime(endDate)}`;
  }

  if (startDayKey === currentDayKey) {
    return `Starts ${formatShortTime(startDate)}`;
  }

  if (endDate && endDayKey === currentDayKey) {
    return `Until ${formatShortTime(endDate)}`;
  }

  return "Multi-day";
}

function buildWeekDays(weekRange: { start: string; end: string }, events: CalendarEvent[]) {
  const startDate = parseCalendarDate(weekRange.start);
  if (!startDate) return [];

  const todayKey = toDayKey(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    date.setHours(0, 0, 0, 0);

    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayEvents = events
      .filter((event) => {
        const eventStart = parseCalendarDate(event.start);
        const eventEnd = parseCalendarDate(event.end) ?? eventStart;
        if (!eventStart || !eventEnd) return false;
        return eventStart < dayEnd && eventEnd >= dayStart;
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      date,
      dayKey: toDayKey(date),
      isToday: toDayKey(date) === todayKey,
      label: date.toLocaleDateString([], { day: "numeric" }),
      weekday: date.toLocaleDateString([], { weekday: "short" }),
      events: dayEvents,
    };
  });
}

function getUpcomingEvent(events: CalendarEvent[]) {
  const now = Date.now();

  return [...events]
    .filter((event) => {
      const endDate = parseCalendarDate(event.end) ?? parseCalendarDate(event.start);
      return !!endDate && endDate.getTime() >= now;
    })
    .sort((a, b) => a.timestamp - b.timestamp)[0];
}

export function CalendarView({
  weekOffset,
  setWeekOffset,
  refreshEvents,
  weekRange,
  setCreateEventOpen,
  eventsLoading,
  eventsFetching,
  calendarError,
  onReconnect,
  LoaderIcon,
  events,
  deleteEvent,
}: CalendarViewProps) {
  const weekDays = buildWeekDays(weekRange, events);
  const weekLabel = formatWeekRangeLabel(weekRange);
  const upcomingEvent = getUpcomingEvent(events);
  const busyDays = weekDays.filter((day) => day.events.length > 0).length;
  const todaysMeetings = weekDays.find((day) => day.isToday)?.events.length ?? 0;
  const isBusy = eventsFetching || refreshEvents.isPending;

  return (
    <section className="relative flex-1 overflow-hidden bg-zinc-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%)]" />

      <div className="relative border-b border-white/6 bg-zinc-950/85 backdrop-blur-xl">
        <div className="flex flex-col gap-5 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
                <CalendarDays size={12} />
                Google Calendar
              </span>
              <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                {weekLabel}
              </span>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  isBusy
                    ? "border-sky-400/20 bg-sky-500/10 text-sky-200"
                    : "border-emerald-400/15 bg-emerald-500/8 text-emerald-200",
                )}
              >
                {isBusy ? "Syncing calendar..." : "Primary calendar live"}
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white">Calendar Schedule</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Your week at a glance with cleaner daily focus, direct Google Calendar links, and
                live sync controls built into the workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
              <button
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/8 hover:text-zinc-100"
                title="Previous week"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/8"
              >
                Today
              </button>
              <button
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/8 hover:text-zinc-100"
                title="Next week"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              onClick={() => refreshEvents.mutate({ weekStart: weekRange.start, weekEnd: weekRange.end })}
              disabled={refreshEvents.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
              title="Sync Events"
            >
              <RefreshCw size={14} className={refreshEvents.isPending ? "animate-spin" : ""} />
              Sync
            </button>

            <a
              href="https://calendar.google.com/calendar/u/0/r"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/8"
            >
              <ArrowUpRight size={14} />
              Open Google Calendar
            </a>

            <button
              onClick={() => setCreateEventOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:scale-[1.01] hover:from-sky-400 hover:to-indigo-400"
            >
              <Plus size={14} />
              Create Event
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto p-6">
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-sky-500/18 via-zinc-950 to-emerald-500/12 p-5 shadow-[0_24px_80px_-36px_rgba(14,165,233,0.45)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
                <Sparkles size={12} />
                This Week
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Meetings</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{events.length}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Busy Days</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{busyDays}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Today</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{todaysMeetings}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">View</div>
                  <div className="mt-2 text-lg font-semibold text-white">Week</div>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-300">
                {upcomingEvent
                  ? `Next up: ${upcomingEvent.summary || "Untitled event"}`
                  : "Clear week so far. Add an event or sync again to pull the latest changes."}
              </p>
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/5 p-5 backdrop-blur-md">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Upcoming
              </div>

              {upcomingEvent ? (
                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-xs font-medium text-sky-300">
                    {formatEventWhen(upcomingEvent.start, upcomingEvent.end)}
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    {upcomingEvent.summary || "Untitled event"}
                  </h3>
                  {upcomingEvent.location ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                      <MapPin size={14} className="text-zinc-500" />
                      <span className="truncate">{upcomingEvent.location}</span>
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                    <Users2 size={14} className="text-zinc-500" />
                    <span>{getAttendeeSummary(upcomingEvent.attendees)}</span>
                  </div>
                  {upcomingEvent.htmlLink ? (
                    <a
                      href={upcomingEvent.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-300 transition hover:text-sky-200"
                    >
                      Open in Google Calendar
                      <ArrowUpRight size={14} />
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm leading-6 text-zinc-400">
                  No meetings coming up in this view. That’s a good moment to block focus time or
                  pull fresh changes from Google Calendar.
                </div>
              )}
            </div>
          </aside>

          <div className="space-y-4">
            {calendarError ? (
              <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-rose-50">
                <div className="text-sm font-semibold">Google Calendar needs attention</div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-100/85">
                  {calendarError.message || "We couldn't load your calendar right now."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={onReconnect}
                    className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
                  >
                    Reconnect Google
                  </button>
                  <button
                    onClick={() => refreshEvents.mutate({ weekStart: weekRange.start, weekEnd: weekRange.end })}
                    className="rounded-xl border border-rose-200/15 px-4 py-2 text-sm text-rose-100 transition hover:bg-rose-500/10"
                  >
                    Try Sync Again
                  </button>
                </div>
              </div>
            ) : null}

            {eventsLoading && events.length === 0 ? (
              <div className="rounded-3xl border border-white/8 bg-white/5 p-10 text-center backdrop-blur-md">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/15 bg-sky-500/10 text-sky-300">
                  <LoaderIcon />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">Loading your week</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Pulling the latest events from your Google Calendar workspace.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-7">
                {weekDays.map((day) => (
                  <div
                    key={day.dayKey}
                    className={cn(
                      "min-h-[280px] rounded-3xl border bg-white/[0.035] p-4 backdrop-blur-md",
                      day.isToday
                        ? "border-sky-400/25 shadow-[0_22px_70px_-38px_rgba(56,189,248,0.45)]"
                        : "border-white/8",
                    )}
                  >
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          {day.weekday}
                        </div>
                        <div className="mt-1 text-2xl font-semibold text-white">{day.label}</div>
                      </div>
                      {day.isToday ? (
                        <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
                          Today
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {day.events.length > 0 ? (
                        day.events.map((event) => (
                          <article
                            key={`${day.dayKey}-${event.id}`}
                            className="group rounded-2xl border border-white/10 bg-zinc-950/80 p-3 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.85)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[11px] font-medium text-sky-300">
                                  <Clock3 size={12} />
                                  <span>{getEventChipLabel(event, day.date)}</span>
                                </div>
                                <h4 className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-50">
                                  {event.summary || "Untitled event"}
                                </h4>
                              </div>

                              <div className="flex items-center gap-1">
                                {event.htmlLink ? (
                                  <a
                                    href={event.htmlLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/8 hover:text-zinc-100"
                                    title="Open in Google Calendar"
                                  >
                                    <ArrowUpRight size={14} />
                                  </a>
                                ) : null}
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete "${event.summary}"? This cannot be undone.`)) {
                                      deleteEvent.mutate({ id: event.id });
                                    }
                                  }}
                                  className="rounded-lg p-2 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                                  title="Delete event"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 space-y-2 text-[12px] text-zinc-400">
                              {event.location ? (
                                <div className="flex items-center gap-2">
                                  <MapPin size={13} className="shrink-0 text-zinc-500" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              ) : null}

                              <div className="flex items-center gap-2">
                                <Users2 size={13} className="shrink-0 text-zinc-500" />
                                <span>{getAttendeeSummary(event.attendees)}</span>
                              </div>
                            </div>

                            {event.description ? (
                              <p className="mt-3 line-clamp-3 text-[12px] leading-5 text-zinc-500">
                                {event.description}
                              </p>
                            ) : null}

                            <div className="mt-3 border-t border-white/8 pt-3 text-[11px] text-zinc-500">
                              {formatEventWhen(event.start, event.end)}
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">
                          Free day. No meetings scheduled.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
