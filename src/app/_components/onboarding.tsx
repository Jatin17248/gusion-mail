import { useState } from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import { Shield, Lock, CheckCircle, Loader, LogOut } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import Image from "next/image";

export function Onboarding() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<"idle" | "provisioning" | "success" | "error">("idle");
  const [progressMsg, setProgressMsg] = useState("");

  const { data: googleStatus, isLoading: checkingGoogle } = api.auth.hasGoogleOAuth.useQuery();

  const provisionMutation = api.auth.provisionTenant.useMutation({
    onMutate: () => {
      setStatus("provisioning");
      setProgressMsg("Connecting to Gmail…");
      setTimeout(() => setProgressMsg("Setting up your inbox…"), 800);
      setTimeout(() => setProgressMsg("Securing your account…"), 1600);
      setTimeout(() => setProgressMsg("Almost there…"), 2400);
    },
    onSuccess: () => {
      setStatus("success");
      toast.success("Inbox connected successfully!");
      trackEvent(session?.user?.id, "onboarding_completed");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    },
    onError: (err) => {
      setStatus("error");
      toast.error("Something went wrong. Please try again.");
    },
  });

  const handleConnect = () => {
    provisionMutation.mutate();
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <Image src="/images/logoWhite.svg" alt="Gusion" width={100} height={28} priority />
        <div className="flex items-center gap-3">
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name ?? ""}
              width={32}
              height={32}
              className="rounded-full ring-1 ring-zinc-700"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold ring-1 ring-zinc-700">
              {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center items-center p-6">
      <div className="absolute top-0 left-1/4 w-125 h-125 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-md shadow-2xl relative">
        {status === "idle" && (
          <>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6">
              <Shield size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Connect your inbox</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Welcome, <span className="text-zinc-100 font-semibold">{session?.user?.name}</span>! Let&apos;s connect your Gmail and Calendar so Gusion can start managing your emails.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 p-1 rounded bg-zinc-800 text-zinc-400">
                  <Lock size={12} />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-zinc-300">Your data stays private</h4>
                  <p className="text-zinc-500 text-xs">Your credentials are securely encrypted and never shared.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 p-1 rounded bg-zinc-800 text-zinc-400">
                  <CheckCircle size={12} />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-semibold text-zinc-300">Gmail &amp; Calendar access</h4>
                  <p className="text-zinc-500 text-xs">Gusion will read and manage your emails and calendar events.</p>
                </div>
              </div>
            </div>

            {checkingGoogle ? (
              <div className="w-full py-3 flex items-center justify-center">
                <Loader className="w-5 h-5 text-indigo-400 animate-spin" />
              </div>
            ) : googleStatus?.linked ? (
              <button
                onClick={handleConnect}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition cursor-pointer"
              >
                Get Started
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 text-center">
                  You need to connect your Google account to use Gusion Mail.
                </p>
                <button
                  onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
                  className="w-full py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-medium rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Connect Google Account
                </button>
              </div>
            )}
          </>
        )}

        {status === "provisioning" && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Loader className="w-10 h-10 text-indigo-500 animate-spin mb-6" />
            <h3 className="text-lg font-semibold text-white mb-2">Connecting your inbox…</h3>
            <p className="text-zinc-400 text-sm animate-pulse">{progressMsg}</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-6 border border-emerald-500/20">
              <CheckCircle size={24} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">You&apos;re all set!</h3>
            <p className="text-zinc-400 text-sm">Taking you to your inbox…</p>
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
    </div>
  );
}
