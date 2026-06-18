"use client";

import { use, useState, useEffect } from "react";
import { api } from "@/trpc/react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Check, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BookPage({ params }: PageProps) {
  const { slug } = use(params);

  // Time window: query availability for the next 14 days
  const [startDate] = useState(() => new Date());
  const [endDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d;
  });

  const { data, isLoading, error, refetch } = api.scheduling.getPublicAvailability.useQuery({
    slug,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  const createBookingMutation = api.scheduling.createBooking.useMutation({
    onSuccess: () => {
      setBookingSuccess(true);
      toast.success("Meeting booked successfully! Calendar invitation sent.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to book meeting. Please try again.");
    },
  });

  // Selected date & slot states
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  
  // Invitee details
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Group slots by local date
  const [groupedSlots, setGroupedSlots] = useState<Record<string, { start: string; end: string }[]>>({});
  const [dateList, setDateList] = useState<string[]>([]);

  useEffect(() => {
    if (data?.slots) {
      const groups: Record<string, { start: string; end: string }[]> = {};
      data.slots.forEach((slot) => {
        const localDate = new Date(slot.start).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        groups[localDate] ??= [];
        groups[localDate].push(slot);
      });
      setGroupedSlots(groups);
      
      const sortedDates = Object.keys(groups).sort((a, b) => {
        return new Date(groups[a]![0]!.start).getTime() - new Date(groups[b]![0]!.start).getTime();
      });
      setDateList(sortedDates);
      
      if (sortedDates.length > 0 && !selectedDateStr) {
        setSelectedDateStr(sortedDates[0]!);
      }
    }
  }, [data, selectedDateStr]);

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    createBookingMutation.mutate({
      slug,
      inviteeName,
      inviteeEmail,
      slotStart: selectedSlot.start,
      slotEnd: selectedSlot.end,
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatLocalDateFull = (isoString: string) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-zinc-400 font-medium">Checking availability...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50 px-4">
        <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center backdrop-blur-xl">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="mt-4 text-xl font-bold tracking-tight">Booking Link Unavailable</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {error?.message ?? "This booking page does not exist or has been disabled."}
          </p>
        </div>
      </div>
    );
  }

  if (bookingSuccess && selectedSlot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50 px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full rounded-2xl border border-emerald-500/20 bg-zinc-900/40 p-8 text-center backdrop-blur-2xl shadow-xl shadow-emerald-950/10"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Check className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-zinc-50">Meeting Booked!</h2>
          <p className="mt-2 text-zinc-400 text-sm">
            A confirmation calendar invite has been sent to <span className="font-semibold text-zinc-200">{inviteeEmail}</span>.
          </p>

          <div className="mt-6 rounded-xl bg-zinc-950/50 border border-zinc-800/80 p-4 text-left space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-indigo-400 mt-1" />
              <div>
                <p className="text-xs text-zinc-500">Date</p>
                <p className="text-sm font-medium text-zinc-200">{formatLocalDateFull(selectedSlot.start)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-indigo-400 mt-1" />
              <div>
                <p className="text-xs text-zinc-500">Time</p>
                <p className="text-sm font-medium text-zinc-200">
                  {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                </p>
              </div>
            </div>
            <div className="border-t border-zinc-800/50 pt-3 flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-xs font-semibold text-indigo-400 mt-0.5 border border-indigo-500/20">
                {inviteeName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-zinc-500">Invitee</p>
                <p className="text-sm font-medium text-zinc-200">{inviteeName}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setBookingSuccess(false);
              setSelectedSlot(null);
              setInviteeName("");
              setInviteeEmail("");
              void refetch();
            }}
            className="mt-8 w-full rounded-xl bg-zinc-800 border border-zinc-700 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-750"
          >
            Book Another Meeting
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-purple-500/5 blur-[120px]" />
      </div>

      <div className="relative max-w-4xl w-full rounded-3xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-150">
        {/* Left side details pane */}
        <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-zinc-800/60 p-6 sm:p-8 flex flex-col justify-between bg-zinc-900/10">
          <div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 text-lg font-bold">
              {data.hostName.charAt(0).toUpperCase()}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Host</p>
            <h2 className="text-lg font-bold text-zinc-200">{data.hostName}</h2>
            
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-zinc-50 bg-linear-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
              {data.link.title}
            </h1>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <Clock className="h-4 w-4 text-zinc-500" />
                <span>{data.link.durationMins} minutes duration</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <Calendar className="h-4 w-4 text-zinc-500" />
                <span>All slots in local timezone</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-zinc-800/40 text-xs text-zinc-500">
            Powered by <span className="font-semibold text-zinc-400">Gusion Mail</span>
          </div>
        </div>

        {/* Right side scheduler/form pane */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          {!selectedSlot ? (
            <div className="flex-1 flex flex-col min-h-[400px]">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
                Select Date & Time
              </h3>
              
              {/* Date horizontal selector */}
              {dateList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800 rounded-2xl">
                  <Calendar className="h-8 w-8 text-zinc-600 mb-2" />
                  <p className="text-zinc-400 text-sm font-medium">No available slots found</p>
                  <p className="text-zinc-600 text-xs mt-1">Please contact the host for meeting schedule.</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none snap-x mask-fade-r">
                    {dateList.map((dateStr) => {
                      const isSelected = selectedDateStr === dateStr;
                      const parts = dateStr.split(",");
                      const dayName = parts[0]?.trim() ?? "";
                      const monthDay = parts[1]?.trim() ?? "";
                      
                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDateStr(dateStr)}
                          className={`shrink-0 snap-start flex flex-col items-center justify-center w-24 h-20 rounded-xl border transition-all ${
                            isSelected
                              ? "bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-950/20"
                              : "border-zinc-800 bg-zinc-950/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                          }`}
                        >
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                            {dayName}
                          </span>
                          <span className="text-sm font-extrabold mt-1">
                            {monthDay}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Slot grid */}
                  <div className="flex-1 mt-6 overflow-y-auto max-h-75 pr-2 space-y-2">
                    <AnimatePresence mode="wait">
                      {selectedDateStr && groupedSlots[selectedDateStr] && (
                        <motion.div
                          key={selectedDateStr}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="grid grid-cols-2 gap-2"
                        >
                          {groupedSlots[selectedDateStr].map((slot, index) => (
                            <button
                              key={index}
                              onClick={() => setSelectedSlot(slot)}
                              className="border border-zinc-800 bg-zinc-950/40 rounded-xl py-3 text-center text-sm font-medium hover:border-indigo-500/50 hover:bg-indigo-500/5 transition duration-200"
                            >
                              {formatTime(slot.start)}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 flex flex-col justify-between"
            >
              <div>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 mb-6 transition"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Choose another slot</span>
                </button>

                <h3 className="text-lg font-bold text-zinc-100 mb-2">
                  Confirm Booking Details
                </h3>
                <p className="text-xs text-zinc-400 mb-6 flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>{formatLocalDateFull(selectedSlot.start)} at {formatTime(selectedSlot.start)}</span>
                </p>

                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Your Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={inviteeName}
                      onChange={(e) => setInviteeName(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950/80 border border-zinc-800 px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="jane@company.com"
                      value={inviteeEmail}
                      onChange={(e) => setInviteeEmail(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950/80 border border-zinc-800 px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-zinc-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={createBookingMutation.isPending}
                    className="w-full mt-6 rounded-xl bg-indigo-600 text-white font-semibold py-3 hover:bg-indigo-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {createBookingMutation.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        <span>Scheduling...</span>
                      </>
                    ) : (
                      <span>Schedule Meeting</span>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
