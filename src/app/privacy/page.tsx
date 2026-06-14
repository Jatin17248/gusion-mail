import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Privacy Policy</h1>
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
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2">1. Data Scopes & Minimization</h2>
            <p>
              Gusion Mail connects to your Google account using restricted Gmail and Calendar API scopes. We only request the minimum permissions necessary to view, modify, and compose emails and manage calendar events as requested through keyboard commands or AI agent tools.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2">2. Secure Sandbox Isolation</h2>
            <p>
              Your credentials and synced data are stored inside an isolated multi-tenant database sandbox. Every user&apos;s connection parameters are encrypted using a rotatable, unique Data Encryption Key (DEK). We do not store email body texts locally on our main application database tables; they reside strictly inside the secure integration caching layers.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2">3. Google CASA Compliance</h2>
            <p>
              We comply fully with the Google CASA (Cloud Application Security Assessment) requirements. Regular automated vulnerability checks are run to ensure integration hooks remain secure and uncompromised.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2">4. User Autonomy & Deletion</h2>
            <p>
              You maintain complete control over your data. You can export a full backup of your account meta-information at any time from your settings panel. Deleting your account will instantly and permanently purge your local database rows, clear cached credentials, and revoke Google integration tokens.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
