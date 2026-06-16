import { api } from "@/trpc/react";
import { Loader2, Link2, Star, Mail } from "lucide-react";
import { toast } from "sonner";

export function ConnectedAccountsSettings() {
  const { data: accounts, isLoading, refetch } = api.connectedAccounts.listAccounts.useQuery();
  const setDefault = api.connectedAccounts.setDefault.useMutation({
    onSuccess: () => {
      toast.success("Default account updated");
      void refetch();
    },
    onError: (err) => toast.error(err.message || "Failed to set default account"),
  });

  return (
    <div className="space-y-8">
      <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        <h3 className="text-md font-bold text-zinc-200 mb-2 flex items-center gap-2">
          <Link2 size={16} className="text-indigo-400" />
          Connected Accounts
        </h3>
        <p className="text-zinc-400 text-xs mb-6">
          Connect multiple Google accounts and easily switch between them or set a default.
        </p>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-zinc-500" /></div>
        ) : (
          <div className="space-y-4">
            {accounts?.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-850 bg-zinc-950/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Mail size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                      {acc.email}
                      {acc.isDefault && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 capitalize">{acc.provider}</div>
                  </div>
                </div>
                
                {!acc.isDefault && (
                  <button
                    onClick={() => setDefault.mutate({ accountId: acc.id })}
                    disabled={setDefault.isPending}
                    className="p-2 text-zinc-400 hover:text-yellow-400 transition cursor-pointer"
                    title="Set as Default"
                  >
                    <Star size={16} />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => toast.info("OAuth flow to connect another account goes here.")}
              className="w-full py-3 mt-2 border border-dashed border-zinc-800 rounded-xl text-zinc-400 text-xs font-semibold hover:bg-zinc-900/50 hover:text-zinc-200 transition"
            >
              + Connect Another Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
