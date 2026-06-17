import { signIn } from "next-auth/react";
import { Cpu, Keyboard, Zap, ShieldCheck } from "lucide-react";

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 flex flex-col justify-between">
      {/* Background radial glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            G
          </div>
          <span className="font-bold text-lg tracking-tight bg-linear-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Gusion Mail
          </span>
        </div>
        <div>
          <button
            onClick={() => signIn("google")}
            className="px-4 py-2 text-sm font-medium bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition text-zinc-100 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero Body */}
      <main className="container mx-auto px-6 py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs font-medium text-indigo-400 mb-8 backdrop-blur-sm">
          <Zap size={12} className="animate-pulse" />
          <span>Now in Public Trial — 14 Days Free</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15] mb-6">
          The AI command center for{" "}
          <span className="bg-linear-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            email & calendar
          </span>
        </h1>

        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl leading-relaxed mb-10">
          Triage your inbox at the speed of thought, let AI prioritize your messages, and run your scheduling from a keyboard-first console.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <button
            onClick={() => signIn("google")}
            className="w-full sm:w-auto px-8 py-4 bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-medium rounded-xl shadow-xl shadow-indigo-500/20 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Get Started with Google</span>
            <span className="text-indigo-200">→</span>
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full text-left">
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/40 backdrop-blur-md hover:border-zinc-800 transition">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
              <Keyboard size={20} />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Keyboard-Driven Speed</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Archive, reply, snooze, or switch folders in a single keystroke. Superhuman-grade responsiveness with optimistic states.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/40 backdrop-blur-md hover:border-zinc-800 transition">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 mb-4">
              <Cpu size={20} />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Gemini AI Priority</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Automatic prioritization badges and Smart Replies drafted contextually using the latest Gemini models.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/40 backdrop-blur-md hover:border-zinc-800 transition">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Secure Scoped Isolation</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Every user receives an isolated Corsair tenant. Your OAuth tokens are safely encrypted and hosted in sandbox environments.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-zinc-900 text-center text-zinc-600 text-xs">
        <p>© {new Date().getFullYear()} Gusion Mail. All rights reserved. Google and Gmail are trademarks of Google LLC.</p>
      </footer>
    </div>
  );
}
