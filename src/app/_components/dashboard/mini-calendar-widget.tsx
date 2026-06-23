"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { api } from "@/trpc/react";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface MiniCalendarWidgetProps {
  onNavigateToCalendar: (date?: Date) => void;
}

export function MiniCalendarWidget({ onNavigateToCalendar }: MiniCalendarWidgetProps) {
  const today = new Date();
  const [displayDate, setDisplayDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const { data: events = [] } = api.calendar.searchEvents.useQuery(
    {
      query: "",
      weekStart: monthStart.toISOString(),
      weekEnd: monthEnd.toISOString(),
    },
    { retry: false, staleTime: 120000 }
  );

  // Map of "YYYY-M-D" -> count for quick lookup
  const eventCountByDay = new Map<string, number>();
  for (const ev of events) {
    const d = new Date(ev.start);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    eventCountByDay.set(key, (eventCountByDay.get(key) ?? 0) + 1);
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setDisplayDate(new Date(year, month - 1, 1));
  const nextMonth = () => setDisplayDate(new Date(year, month + 1, 1));
  const goToToday = () => setDisplayDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthLabel = displayDate.toLocaleString("default", { month: "long", year: "numeric" });
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Build calendar grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="shrink-0 border-b border-zinc-900 bg-zinc-950 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={13} className="text-indigo-400" />
          <span className="text-xs font-semibold text-zinc-200">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded transition cursor-pointer mr-1"
            >
              Today
            </button>
          )}
          <button
            onClick={prevMonth}
            className="p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 rounded-md transition cursor-pointer"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 rounded-md transition cursor-pointer"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold text-zinc-700 uppercase tracking-wide py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;

          const isToday = isCurrentMonth && today.getDate() === day;
          const dateKey = `${year}-${month}-${day}`;
          const count = eventCountByDay.get(dateKey) ?? 0;
          const hasEvent = count > 0;

          return (
            <button
              key={`day-${day}`}
              onClick={() => onNavigateToCalendar(new Date(year, month, day))}
              className={`relative flex flex-col items-center justify-center py-1 rounded-lg cursor-pointer transition text-[11px] font-medium group ${
                isToday
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {day}
              {hasEvent && (
                <div
                  className={`absolute bottom-0.5 flex gap-px ${isToday ? "opacity-70" : ""}`}
                >
                  {Array.from({ length: Math.min(count, 3) }).map((_, dotIdx) => (
                    <div
                      key={dotIdx}
                      className={`w-0.75 h-0.75 rounded-full ${
                        isToday ? "bg-white" : "bg-indigo-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer link */}
      <div className="mt-3 pt-2 border-t border-zinc-900">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-600">
            {events.length > 0
              ? `${events.length} event${events.length === 1 ? "" : "s"} this month`
              : "No events this month"}
          </span>
          <button
            onClick={() => onNavigateToCalendar()}
            className="text-[10px] font-medium text-indigo-500 hover:text-indigo-400 transition cursor-pointer"
          >
            Full calendar →
          </button>
        </div>
      </div>
    </div>
  );
}
