"use client";

import { api } from "@/trpc/react";
import { toast } from "sonner";
import { X, Check, Loader2, Sparkles } from "lucide-react";

const PRO_FEATURES = [
  "AI compose, smart replies & thread summaries",
  "Smart Compose autocomplete",
  "AI priority inbox & daily brief",
  "Send later, follow-up reminders & snooze",
  "Scheduling links & calendar AI",
  "Priority support",
];

export function UpgradeModal({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
}) {
  const { data: subscription } = api.billing.getSubscription.useQuery(undefined, {
    enabled: open,
  });

  const createCheckout = api.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if ("url" in data && data.url) {
        window.location.href = data.url;
      } else if ("payuUrl" in data && data.payuUrl) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.payuUrl;
        Object.entries(data.params ?? {}).forEach(([k, v]) => {
          const field = document.createElement("input");
          field.type = "hidden";
          field.name = k;
          field.value = String(v ?? "");
          form.appendChild(field);
        });
        document.body.appendChild(form);
        form.submit();
      }
    },
    onError: (err) => toast.error(err.message || "Failed to start checkout"),
  });

  if (!open) return null;

  const trialLeft = subscription?.trialDaysRemaining ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 z-10"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Upgrade to Gusion Pro</h3>
          </div>
          <p className="text-xs text-zinc-400 mb-5">
            {reason ??
              (trialLeft > 0
                ? `You have ${trialLeft} day${trialLeft === 1 ? "" : "s"} left in your trial. Upgrade any time to keep everything.`
                : "Unlock the full AI workspace and keep your workflow uninterrupted.")}
          </p>

          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 mb-5">
            <div className="flex items-end gap-1 mb-3">
              <span className="text-3xl font-bold text-zinc-100">₹999</span>
              <span className="text-sm text-zinc-400 mb-1">/ month</span>
            </div>
            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">
                  <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => createCheckout.mutate()}
            disabled={createCheckout.isPending}
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {createCheckout.isPending && <Loader2 size={16} className="animate-spin" />}
            Upgrade to Pro
          </button>
          <p className="text-[11px] text-zinc-500 text-center mt-3">
            Secure payment via PayU. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
