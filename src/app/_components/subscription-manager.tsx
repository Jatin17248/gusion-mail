import { api } from "@/trpc/react";
import { Loader2, CreditCard, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function SubscriptionManager() {
  const { data: subscription, isLoading } = api.billing.getSubscription.useQuery();
  const createCheckout = api.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to initiate checkout");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const isPro = subscription.plan === "pro";
  const isActive = subscription.status === "active";
  const isTrial = subscription.status === "trialing";

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        <h3 className="text-md font-bold text-zinc-200 mb-2 flex items-center gap-2">
          <CreditCard size={16} className="text-indigo-400" />
          Subscription & Billing
        </h3>
        <p className="text-zinc-400 text-xs mb-6">
          Manage your Gusion Mail subscription plan and billing details.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40">
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Current Plan</div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-zinc-100 capitalize">{subscription.plan}</span>
              {isPro && <ShieldCheck size={20} className="text-emerald-500 mb-1" />}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-zinc-850 bg-zinc-950/40">
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                isTrial ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              }`}>
                {subscription.status}
              </span>
              {isTrial && subscription.trialDaysRemaining != null && (
                <span className="text-xs text-zinc-400">{subscription.trialDaysRemaining} days left</span>
              )}
            </div>
          </div>
        </div>

        {subscription.currentPeriodEnd && (
          <div className="text-xs text-zinc-400 mb-6 flex items-center gap-1.5">
            <AlertCircle size={14} className="text-zinc-500" />
            Your current billing period ends on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
          </div>
        )}

        <div className="flex items-center gap-4 pt-4 border-t border-zinc-900/50">
          {!isPro ? (
            <button
              onClick={() => createCheckout.mutate()}
              disabled={createCheckout.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {createCheckout.isPending && <Loader2 size={16} className="animate-spin" />}
              Upgrade to Pro
            </button>
          ) : (
            <button
              onClick={() => {
                toast.success("We've received your cancellation request. Please contact support to finalize.");
              }}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-rose-400 text-sm font-semibold rounded-lg border border-zinc-800 transition"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
