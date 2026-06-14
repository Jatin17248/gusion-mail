import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-6 relative">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[60%] h-[60%] rounded-full bg-purple-500/5 blur-[120px]" />
      </div>

      <div className="max-w-2xl w-full rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-xl p-8 sm:p-12 shadow-2xl relative">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Terms of Service</h1>
              <p className="text-xs text-zinc-500">Last updated: June 2026</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            <ArrowLeft size={12} />
            <span>Back</span>
          </Link>
        </div>

        <div className="space-y-6 text-sm text-zinc-400 leading-relaxed">
          <section>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2">1. Terms Acceptance</h2>
            <p>
              By accessing Gusion Mail, you agree to connect your Google Workspace / Gmail account to provision an isolated tenant for calendar and email command triage. If you do not agree, do not complete the onboarding setup.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2">2. Subscriptions & Trials</h2>
            <p>
              New users receive a 14-day free trial containing full access to Gusion Pro features (including AI Compose, daily briefs, public scheduling booking links, and follow-ups). After trial expiration, an active Stripe subscription is required to maintain access to premium procedures.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2">3. Acceptable Use</h2>
            <p>
              You may not use Gusion Mail&apos;s API tools to send bulk unsolicited spam, perform automated scraping operations, or execute malicious email campaigns. Violations will result in immediate termination of the sandbox account.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2">4. Disclaimers & Liabilities</h2>
            <p>
              Gusion Mail is provided &ldquo;as is&rdquo;. We rely on external systems (Google Workspace APIs, Stripe payment infrastructure) and cannot guarantee 100% uninterrupted uptime. Under no circumstances will we be liable for indirect, incidental, or consequential damages.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
