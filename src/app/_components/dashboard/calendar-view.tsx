import { ChevronLeft, ChevronRight, RefreshCw, Plus, Trash2 } from "lucide-react";
import { formatEventWhen, formatAttendees } from "@/app/_components/dashboard";

interface CalendarViewProps {
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  refreshEvents: any;
  weekRange: { start: string; end: string };
  setCreateEventOpen: (open: boolean) => void;
  eventsLoading: boolean;
  LoaderIcon: React.FC;
  events: any[];
  deleteEvent: any;
}

export function CalendarView({
  weekOffset,
  setWeekOffset,
  refreshEvents,
  weekRange,
  setCreateEventOpen,
  eventsLoading,
  LoaderIcon,
  events,
  deleteEvent,
}: CalendarViewProps) {
  return (
    <section className="flex-1 flex flex-col bg-zinc-950">
      {/* Calendar Header */}
      <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white">Calendar Schedule</h2>
          <div className="flex items-center gap-1 border border-zinc-800 rounded-lg p-0.5 bg-zinc-900/30">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition cursor-pointer font-medium"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshEvents.mutate({ weekStart: weekRange.start, weekEnd: weekRange.end })}
            disabled={refreshEvents.isPending}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg transition cursor-pointer disabled:opacity-50"
            title="Sync Events"
          >
            <RefreshCw size={14} className={refreshEvents.isPending ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setCreateEventOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <Plus size={12} />
            <span>Create Event</span>
          </button>
        </div>
      </div>

      {/* Events view list / grid */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {eventsLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-2">
            <LoaderIcon />
            <span className="text-xs">Loading schedule...</span>
          </div>
        ) : !events || events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-center">
            <h3 className="text-sm font-semibold text-zinc-400 mb-1">No events scheduled</h3>
            <p className="text-xs text-zinc-500">You are free this week!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-5 rounded-xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-sm relative group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="text-sm font-bold text-zinc-100 truncate">{event.summary || "(No Title)"}</h4>
                    <button
                      onClick={() => deleteEvent.mutate({ id: event.id })}
                      className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title="Delete Event"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-xs text-indigo-400 font-medium mb-3">
                    {formatEventWhen(event.start, event.end)}
                  </p>
                  {event.location && (
                    <p className="text-[11px] text-zinc-400 mb-2 truncate">
                      <span className="font-semibold text-zinc-500">Location:</span> {event.location}
                    </p>
                  )}
                  {event.description && (
                    <p className="text-[11px] text-zinc-500 line-clamp-3 leading-relaxed mb-3">
                      {event.description}
                    </p>
                  )}
                </div>
                {event.attendees && event.attendees.length > 0 && (
                  <div className="text-[10px] text-zinc-400 border-t border-zinc-900 pt-3 mt-3">
                    <span className="font-semibold text-zinc-500">Attendees:</span>{" "}
                    {formatAttendees(event.attendees)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
