"use client";

import { api } from "@/trpc/react";
import { Star, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function ContactsSidePanel({ email, name }: { email: string; name: string }) {
  const { data: contact, isLoading, refetch } = api.contacts.getContactByEmail.useQuery({ email });
  const utils = api.useUtils();
  const [isAdding, setIsAdding] = useState(false);

  const toggleVip = api.contacts.toggleVip.useMutation({
    onSuccess: () => {
      toast.success("VIP status updated!");
      void refetch();
      void utils.gmail.searchEmails.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update VIP status.");
    },
  });

  const addContact = api.contacts.addContact.useMutation({
    onSuccess: () => {
      toast.success("Contact added!");
      setIsAdding(false);
      void refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add contact.");
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Contact Info</h3>
        {contact && (
          <button
            onClick={() => toggleVip.mutate({ email: contact.email, isVip: !contact.isVip })}
            disabled={toggleVip.isPending}
            className={`p-1.5 rounded-md transition ${
              contact.isVip 
                ? "text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
            title={contact.isVip ? "Remove from VIPs" : "Mark as VIP"}
          >
            <Star size={16} className={contact.isVip ? "fill-yellow-400" : ""} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-lg font-bold shrink-0">
            {name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{name || "Unknown"}</div>
            <div className="text-xs text-zinc-400 truncate" title={email}>{email}</div>
          </div>
        </div>

        {contact ? (
          <div className="space-y-3 pt-4 border-t border-zinc-900 text-sm">
            {contact.enrichment && (
              <div className="pt-3 border-t border-zinc-900/50">
                <div className="text-xs font-medium text-zinc-500 mb-1">Enrichment Data</div>
                <p className="text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono">
                  {contact.enrichment}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="pt-4 border-t border-zinc-900 space-y-3">
            <p className="text-xs text-zinc-500">This person is not in your contacts.</p>
            <button
              onClick={() => {
                setIsAdding(true);
                addContact.mutate({ email, name, isVip: false });
              }}
              disabled={isAdding || addContact.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg transition border border-zinc-800"
            >
              {addContact.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Add to Contacts
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
