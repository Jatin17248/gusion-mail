import { useState, useMemo } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { RefreshCw, HelpCircle, Sparkles, Mail } from "lucide-react";

export function TicketsView({
  onOpenMessage,
}: {
  onOpenMessage: (messageId: string) => void;
}) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");

  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } = api.tickets.listTickets.useQuery();
  const { data: teamMembers } = api.org.listMembers.useQuery();
  
  const { data: ticketNotes, refetch: refetchNotes } = api.tickets.getNotes.useQuery(
    { ticketId: selectedTicketId! },
    { enabled: !!selectedTicketId }
  );

  const addNote = api.tickets.addNote.useMutation({
    onSuccess: () => {
      setNoteContent("");
      void refetchNotes();
    },
    onError: (err) => toast.error(err.message || "Failed to add note."),
  });

  const updateStatus = api.tickets.updateTicketStatus.useMutation({
    onSuccess: () => {
      toast.success("Ticket status updated!");
      void refetchTickets();
    },
    onError: (err) => toast.error(err.message || "Failed to update status."),
  });

  const assignTicket = api.tickets.assignTicket.useMutation({
    onSuccess: () => {
      toast.success("Ticket assignee updated!");
      void refetchTickets();
    },
    onError: (err) => toast.error(err.message || "Failed to assign ticket."),
  });

  const selectedTicket = useMemo(() => {
    return ticketsData?.find((t) => t.id === selectedTicketId) ?? null;
  }, [ticketsData, selectedTicketId]);

  return (
    <section className="flex-1 flex h-full overflow-hidden">
      {/* Ticket List Pane */}
      <div className="w-96 border-r border-zinc-900 flex flex-col bg-zinc-950/20 backdrop-blur-md">
        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Support Tickets</h2>
          <button
            onClick={() => void refetchTickets()}
            className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/60">
          {ticketsLoading ? (
            <div className="p-6 text-zinc-500 text-xs text-center">Loading tickets...</div>
          ) : !ticketsData || ticketsData.length === 0 ? (
            <div className="p-6 text-zinc-500 text-xs text-center">No support tickets found.</div>
          ) : (
            ticketsData.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`w-full p-4 flex flex-col gap-1.5 transition text-left cursor-pointer ${
                  selectedTicketId === ticket.id ? "bg-zinc-900/40" : "hover:bg-zinc-900/10"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                    {ticket.publicId}
                  </span>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded uppercase ${
                    ticket.status === "open"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : ticket.status === "pending"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-zinc-200 truncate">{ticket.subject}</div>
                <div className="text-[10px] text-zinc-400 truncate">From: {ticket.fromName ?? ticket.fromEmail}</div>
                <div className="text-[9px] text-zinc-500 truncate mt-1">
                  {ticket.assignedUser ? `Assigned to: ${ticket.assignedUser.name}` : "Unassigned"}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Ticket Reading / Actions Pane */}
      <div className="flex-1 flex flex-col bg-zinc-950/40 backdrop-blur-md overflow-hidden">
        {!selectedTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-650 text-center">
            <HelpCircle size={32} className="mb-3 text-zinc-750" />
            <h3 className="text-sm font-semibold text-zinc-300 mb-1">No ticket selected</h3>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              Select a ticket from the left panel to manage status, assignments, and view conversations.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden text-left">
            {/* Header */}
            <div className="p-6 border-b border-zinc-900 flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded">
                    {selectedTicket.publicId}
                  </span>
                  <span className="text-zinc-500 text-xs">
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">{selectedTicket.subject}</h2>
                <div className="text-xs text-zinc-400 mt-2">
                  <span className="text-zinc-550 font-medium">Customer: </span>
                  {selectedTicket.fromName ? `${selectedTicket.fromName} (${selectedTicket.fromEmail})` : selectedTicket.fromEmail}
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="p-6 border-b border-zinc-900 grid grid-cols-2 gap-4 bg-zinc-950/20">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Ticket Status</label>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => updateStatus.mutate({ id: selectedTicket.id, status: e.target.value as "open" | "pending" | "resolved" })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Assignee</label>
                <select
                  value={selectedTicket.assignedUserId ?? ""}
                  onChange={(e) => assignTicket.mutate({ id: selectedTicket.id, userId: e.target.value || null })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="">Unassigned</option>
                  {teamMembers?.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Details & Conversation Link */}
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Ticket Description (Snippet)</h4>
                <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/30 text-xs text-zinc-300 leading-relaxed italic">
                  &quot;{selectedTicket.snippet ?? "No description provided."}&quot;
                </div>
              </div>

              {/* Internal Notes */}
              <div className="space-y-4 pt-4 border-t border-zinc-900">
                <h4 className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Internal Notes</h4>
                
                <div className="space-y-3">
                  {ticketNotes?.map((note) => (
                    <div key={note.id} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-semibold text-zinc-300">
                          {note.user?.name ?? "Unknown"}
                        </span>
                        <span className="text-[9px] text-zinc-500">
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                  {ticketNotes?.length === 0 && (
                    <div className="text-xs text-zinc-500 italic">No internal notes yet.</div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Add an internal note..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition min-h-20"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => addNote.mutate({ ticketId: selectedTicket.id, content: noteContent })}
                      disabled={!noteContent.trim() || addNote.isPending}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold rounded transition disabled:opacity-50 cursor-pointer"
                    >
                      {addNote.isPending ? "Adding..." : "Add Note"}
                    </button>
                  </div>
                </div>
              </div>

              {selectedTicket.gmailMessageId && (
                <div className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Superhuman Email Client Integration</span>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    This support ticket is linked directly to an active email thread in your inbox. Open it to write an AI-powered reply, snooze, or archive the thread.
                  </p>
                  <button
                    onClick={() => {
                      if (selectedTicket.gmailMessageId) {
                        onOpenMessage(selectedTicket.gmailMessageId);
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Mail size={12} />
                    <span>Open Email Conversation</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
