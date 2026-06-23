import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  monthOffset: number;
  setMonthOffset: React.Dispatch<React.SetStateAction<number>>;
  refreshEvents: any;
  setCreateEventOpen: (open: boolean) => void;
  eventsLoading: boolean;
  eventsFetching: boolean;
  calendarError?: { message?: string } | null;
  onReconnect: () => void;
  LoaderIcon: React.FC;
  events: CalendarEvent[];
  deleteEvent: any;
}

const EVENT_COLORS = [
  "bg-indigo-500 text-white",
  "bg-violet-500 text-white",
  "bg-blue-500 text-white",
  "bg-sky-500 text-white",
  "bg-emerald-500 text-white",
  "bg-rose-500 text-white",
];

function getEventColor(eventId: string): string {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    hash = eventId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length]!;
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

function formatShortTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getEventTimeLabel(event: CalendarEvent): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.start)) return "All day";
  const startDate = parseCalendarDate(event.start);
  if (!startDate) return "";
  return formatShortTime(startDate);
}

function buildMonthGrid(monthOffset: number, events: CalendarEvent[]) {
  const today = new Date();
  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();

  const gridStart = new Date(year, month, 1 - startDow);
  const todayKey = toDayKey(today);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const dayKey = toDayKey(date);
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
      dayKey,
      dayNum: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dayKey === todayKey,
      events: dayEvents,
    };
  });
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  monthOffset,
  setMonthOffset,
  setCreateEventOpen,
  eventsLoading,
  calendarError,
  onReconnect,
  LoaderIcon,
  events,
  deleteEvent,
}: CalendarViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
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

  const today = new Date();
  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = displayDate.toLocaleDateString([], { month: "long", year: "numeric" });

  const filteredEvents = searchQuery.trim()
    ? events.filter((e) =>
        e.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : events;

  const gridDays = buildMonthGrid(monthOffset, filteredEvents);

  return (
    <section className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 shrink-0 min-w-40">
          {monthLabel}
        </h2>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setMonthOffset((p) => p - 1)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMonthOffset(0)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Today
          </button>
          <button
            onClick={() => setMonthOffset((p) => p + 1)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 shrink-0">
          Month
        </div>

        <button
          onClick={() => setCreateEventOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-100 transition shrink-0"
        >
          <Plus size={14} />
          Create
        </button>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-full text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
          />
        </div>

        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}
      </div>

      {/* Error banner */}
      {calendarError && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-lg border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between gap-3 shrink-0">
          <span>{calendarError.message ?? "Couldn't load calendar events."}</span>
          <button
            onClick={onReconnect}
            className="px-3 py-1 rounded-md bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition shrink-0"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        {eventsLoading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-3">
            <LoaderIcon />
            <span className="text-sm">Loading calendar...</span>
          </div>
        ) : (
          <div className="min-w-[700px] h-full flex flex-col">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Month grid — 6 rows */}
            <div className="flex-1 grid grid-rows-6 grid-cols-7">
              {gridDays.map((day) => (
                <div
                  key={day.dayKey}
                  className={cn(
                    "border-r border-b border-zinc-100 dark:border-zinc-800/60 p-1 min-h-24 flex flex-col",
                    !day.isCurrentMonth && "bg-zinc-50/50 dark:bg-zinc-900/30",
                    "last:border-r-0",
                  )}
                >
                  {/* Day number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium",
                        day.isToday
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold"
                          : day.isCurrentMonth
                          ? "text-zinc-700 dark:text-zinc-300"
                          : "text-zinc-300 dark:text-zinc-600",
                      )}
                    >
                      {day.dayNum}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5 flex-1">
                    {day.events.slice(0, 3).map((event) => (
                      <div
                        key={`${day.dayKey}-${event.id}`}
                        className={cn(
                          "group flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium truncate cursor-default",
                          getEventColor(event.id),
                        )}
                        title={event.summary || "Untitled event"}
                      >
                        <span className="shrink-0 opacity-90">
                          {getEventTimeLabel(event)}
                        </span>
                        <span className="truncate">
                          {event.summary || "Untitled event"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${event.summary}"?`)) {
                              deleteEvent.mutate({ id: event.id });
                            }
                          }}
                          className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete event"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                    {day.events.length > 3 && (
                      <div className="px-1.5 py-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        +{day.events.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
