import { useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Shield, Lock, CheckCircle, Loader } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function Onboarding() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<"idle" | "provisioning" | "success" | "error">("idle");
  const [progressMsg, setProgressMsg] = useState("");

  const provisionMutation = api.auth.provisionTenant.useMutation({
    onMutate: () => {
      setStatus("provisioning");
      setProgressMsg("Generating secure tenant ID...");
      setTimeout(() => setProgressMsg("Provisioning Google API scopes..."), 800);
      setTimeout(() => setProgressMsg("Generating and encrypting DEK keys..."), 1600);
      setTimeout(() => setProgressMsg("Saving sandbox configurations..."), 2400);
    },
    onSuccess: () => {
      setStatus("success");
      toast.success("Tenant provisioned successfully!");
      trackEvent(session?.user?.id, "onboarding_completed");
      // Reload window so useSession updates and routes to dashboard
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (err) => {
      setStatus("error");
      toast.error(err.message || "Failed to provision secure sandbox.");
    },
  });

  const handleConnect = () => {
    provisionMutation.mutate();
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-6">
      <div className="absolute top-0 left-1/4 w-125 h-125 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-md shadow-2xl relative">
        {status === "idle" && (
          <>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6">
              <Shield size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Configure secure sandbox</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Hi <span className="text-zinc-100 font-semibold">{session?.user?.name}</span>, your Google account is signed in. We need to initialize your isolated Corsair tenant to cache emails locally and secure OAuth credentials.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 p-1 rounded bg-zinc-800 text-zinc-400">
                  <Lock size={12} />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-zinc-300">End-to-End Key Encryption</h4>
                  <p className="text-zinc-500 text-xs">Credentials are encrypted at-rest using random 32-byte keys.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 p-1 rounded bg-zinc-800 text-zinc-400">
                  <CheckCircle size={12} />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-zinc-300">Gmail + Calendar scopes</h4>
                  <p className="text-zinc-500 text-xs">Provisions Gmail list/modify and Calendar access.</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleConnect}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition cursor-pointer"
            >
              Initialize Tenant
            </button>
          </>
        )}

        {status === "provisioning" && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Loader className="w-10 h-10 text-indigo-500 animate-spin mb-6" />
            <h3 className="text-lg font-semibold text-white mb-2">Setting up isolated sandbox</h3>
            <p className="text-zinc-400 text-sm animate-pulse">{progressMsg}</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-6 border border-emerald-500/20">
              <CheckCircle size={24} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Sandbox Configured</h3>
            <p className="text-zinc-400 text-sm">Redirecting you to Gusion Mail dashboard...</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="text-rose-500 mb-4 font-bold text-xl">⚠️</div>
            <h3 className="text-lg font-semibold text-white mb-2">Setup Failed</h3>
            <p className="text-rose-400/80 text-sm mb-6 max-w-xs">{provisionMutation.error?.message}</p>
            <button
              onClick={() => setStatus("idle")}
              className="px-6 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-800 transition cursor-pointer text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
