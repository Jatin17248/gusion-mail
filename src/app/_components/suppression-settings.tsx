import { useState } from "react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Shield, Plus, Trash2, Search, Mail } from "lucide-react";

export function SuppressionListSettingsView() {
  const utils = api.useUtils();
  const { data: suppressionList, refetch } = api.bulk.listSuppressionList.useQuery();

  const [emailInput, setEmailInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const addSuppression = api.bulk.addToSuppressionList.useMutation({
    onSuccess: () => {
      toast.success("Email added to suppression list.");
      setEmailInput("");
      void refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add email.");
    },
  });

  const removeSuppression = api.bulk.removeFromSuppressionList.useMutation({
    onSuccess: () => {
      toast.success("Email removed from suppression list.");
      void refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove email.");
    },
  });

  const handleAdd = () => {
    if (!emailInput) return toast.error("Please enter an email address.");
    addSuppression.mutate({ email: emailInput });
  };

  const filteredList = suppressionList?.filter((item) =>
    item.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left">
      <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md space-y-6">
        <div>
          <h3 className="text-md font-bold text-zinc-200 mb-1 flex items-center gap-2">
            <Shield size={16} className="text-rose-400" />
            Bulk Campaign Suppression List
          </h3>
          <p className="text-zinc-500 text-xs">Emails on this list will never receive bulk campaign emails, respecting unsubscribe requests and CAN-SPAM compliance.</p>
        </div>

        {/* Add Email Form */}
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="e.g. unsubscribe-target@client.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-855 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            onClick={handleAdd}
            disabled={addSuppression.isPending || !emailInput}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            <Plus size={14} /> Add Email
          </button>
        </div>

        {/* Search & List */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 border border-zinc-855 rounded-lg">
            <Search size={14} className="text-zinc-500" />
            <input
              type="text"
              placeholder="Search suppression list..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-xs text-zinc-200 placeholder:text-zinc-650"
            />
          </div>

          {!filteredList || filteredList.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-4">No suppressed emails found.</p>
          ) : (
            <div className="border border-zinc-855 rounded-xl divide-y divide-zinc-900 max-h-[300px] overflow-y-auto">
              {filteredList.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between gap-4 bg-zinc-950/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail size={14} className="text-zinc-500" />
                    <span className="text-xs text-zinc-300 font-mono truncate">{item.email}</span>
                  </div>
                  <button
                    onClick={() => removeSuppression.mutate({ email: item.email })}
                    className="p-1 hover:bg-zinc-900 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                    title="Remove Suppression"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
