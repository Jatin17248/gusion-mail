"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Keyboard,
  Cpu,
  Zap,
  ShieldCheck,
  Calendar,
  Sparkles,
  ArrowRight,
  ChevronDown,
  Command,
  Bot,
  Send,
  Layers,
  CheckCircle2,
  Code,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

/* ─── DATA STRUCTURES ─── */

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  // { label: "Bento Grid", href: "#bento" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const STATS = [
  { value: "1.2s", label: "Average AI reply generation time" },
  { value: "489K+", label: "Productive emails sent this month" },
  { value: "85%", label: "Average time saved on inbox management" },
  { value: "10x", label: "Increase in keyboard-shortcut navigation speed" },
];

const PILLARS = [
  {
    icon: Keyboard,
    title: "Superhuman Navigation",
    desc: "Archive, reply, snooze, or search with zero mouse clicks. Command palette, customizable shortcuts, and optimistic UI that loads instantly.",
    bg: "bg-indigo-50/50",
    iconColor: "text-indigo-600",
  },
  {
    icon: Bot,
    title: "AI Draft Agent",
    desc: 'Describe your reply in plain text—"Accept the meeting but keep it under 30 minutes"—and watch a professional response write itself in real time.',
    bg: "bg-purple-50/50",
    iconColor: "text-purple-600",
  },
  {
    icon: Sparkles,
    title: "Daily Morning Brief",
    desc: "Wake up to a 3-sentence summary of yesterday's most critical email threads. Focus on what requires immediate attention first.",
    bg: "bg-indigo-50/50",
    iconColor: "text-indigo-600",
  },
  {
    icon: Calendar,
    title: "Integrated Scheduling",
    desc: "Insert calendar slots directly into your draft with a keyboard shortcut. Let recipients book syncs without navigating away from their inbox.",
    bg: "bg-purple-50/50",
    iconColor: "text-purple-600",
  },
  {
    icon: Layers,
    title: "Unified Accounts",
    desc: "Connect multiple Google, Workspace, or custom accounts. Read, search, and manage a unified priority view in one clean interface.",
    bg: "bg-indigo-50/50",
    iconColor: "text-indigo-600",
  },
  {
    icon: ShieldCheck,
    title: "DPDP & GST Compliant",
    desc: "100% of data is stored in secure Indian datacenters. Full GST-invoicing support and secure OAuth-only calendar & email permissions.",
    bg: "bg-purple-50/50",
    iconColor: "text-purple-600",
  },
];

const MOCK_EMAILS = [
  {
    id: 1,
    sender: "Priya Desai",
    subject: "Diwali Campaign Collaboration",
    time: "10:42 AM",
    unread: true,
    body: "Hey team, just wanted to check if you're open to collaborating on our upcoming Diwali campaign? We need to lock in the pricing structure this week.",
    prompt: "Say we're interested, ask for pricing sheet, and suggest meeting next Monday 3 PM.",
    steps: [
      "Drafting with Gusion AI...",
      "Hi Priya,\n\nThanks for reaching out! We are definitely interested in collaborating on the Diwali Campaign.\n\nCould you please send over your pricing sheet?\n\nAlso, let's schedule a brief sync next Monday at 3 PM to discuss details.\n\nBest,\nJatin",
      "Email sent successfully! ✓"
    ]
  },
  {
    id: 2,
    sender: "Rohan Mehta",
    subject: "Feedback on API Integration v2",
    time: "9:15 AM",
    unread: false,
    body: "Hi Gusion team, we're seeing some unexpected rate limiting errors on the v2 webhook integrations. Can you check if the threshold is configured correctly?",
    prompt: "Tell him we fixed the rate limiting bug and ask him to re-test the webhook payload.",
    steps: [
      "Generating AI Reply...",
      "Hi Rohan,\n\nJust wanted to let you know that we've resolved the rate-limiting bug you experienced in v2.\n\nCould you please re-test your webhook payload and let us know if everything works on your end?\n\nBest,\nJatin",
      "Email sent successfully! ✓"
    ]
  }
];

const COMPANYS = [
  "Google Workspace", "Gmail API", "Stripe India", "Razorpay", "Next.js", "Drizzle ORM"
];

const FAQS = [
  {
    q: "Is Gusion Mail secure? Can you read my emails?",
    a: "No. Gusion Mail authenticates directly with Google OAuth. Your emails are parsed and indexed locally on your device. We do not store or read your message payloads on our servers, ensuring your business intelligence remains entirely private."
  },
  {
    q: "Do you support custom domain emails or multiple accounts?",
    a: "Yes. You can link multiple Gmail and Google Workspace domains (e.g., your personal account and multiple company accounts) and view all prioritized messages in a single unified inbox."
  },
  {
    q: "How does the AI Morning Brief work?",
    a: "Every morning, our local worker engine safely fetches the unread threads from the past 24 hours, runs them through our secure LLM integration, and outputs a 3-sentence summary highlighting actions, urgency levels, and meeting requests."
  },
  {
    q: "Do you offer GST compliant invoices for Indian SMBs?",
    a: "Absolutely. All transactions support Razorpay and Stripe with complete Indian GST invoices, permitting you to claim tax credits seamlessly."
  }
];

/* ─── ANIMATED EMAIL SIMULATOR ─── */
function InboxSimulator() {
  const [selectedMailIndex, setSelectedMailIndex] = useState(0);
  const [typedPrompt, setTypedPrompt] = useState("");
  const [typedEmailText, setTypedEmailText] = useState("");
  const [isTypingPrompt, setIsTypingPrompt] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const activeMail = MOCK_EMAILS[selectedMailIndex] ?? MOCK_EMAILS[0]!;

  useEffect(() => {
    let isCancelled = false;

    // Reset simulation states when mail changes
    setTypedPrompt("");
    setTypedEmailText("");
    setIsSent(false);
    setIsTypingPrompt(true);
    setIsGeneratingEmail(false);

    // Step 1: Type the prompt
    let promptIndex = 0;
    const promptInterval = setInterval(() => {
      if (isCancelled) return;
      if (promptIndex < activeMail.prompt.length) {
        setTypedPrompt(activeMail.prompt.slice(0, promptIndex + 1));
        promptIndex++;
      } else {
        clearInterval(promptInterval);
        setIsTypingPrompt(false);
        setIsGeneratingEmail(true);

        // Step 2: Show generating loader, then write the email
        setTimeout(() => {
          if (isCancelled) return;
          setIsGeneratingEmail(false);
          let emailIndex = 0;
          const emailTargetText = activeMail.steps[1] ?? "";
          const emailInterval = setInterval(() => {
            if (isCancelled) return;
            if (emailIndex < emailTargetText.length) {
              setTypedEmailText(emailTargetText.slice(0, emailIndex + 5));
              emailIndex += 5; // Type faster
            } else {
              clearInterval(emailInterval);
              // Step 3: Trigger send success
              setTimeout(() => {
                if (isCancelled) return;
                setIsSent(true);
                // Step 4: Advance to next mail after delay
                setTimeout(() => {
                  if (isCancelled) return;
                  setSelectedMailIndex((prev) => (prev + 1) % MOCK_EMAILS.length);
                }, 3000);
              }, 1000);
            }
          }, 20);
        }, 1500);
      }
    }, 30);

    return () => {
      isCancelled = true;
      clearInterval(promptInterval);
    };
  }, [selectedMailIndex, activeMail]);

  return (
    <div className="relative w-full max-w-[620px] p-6 sm:p-10 font-sans">
      
      {/* Mockup Window Wrapper (with overflow-hidden) */}
      <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* OS Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-850 bg-zinc-950 text-zinc-400 text-xs">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 animate-pulse" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="ml-1.5 text-[10px] text-zinc-500 select-none">gusion-mail-workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">Connected</span>
            <span className="text-[10px] text-zinc-500 select-none">9:41 AM</span>
          </div>
        </div>

        {/* Mail grid */}
        <div className="grid grid-cols-[140px_1fr] h-[370px] bg-zinc-950">
          {/* Left Inbox List */}
          <div className="border-r border-zinc-850 flex flex-col h-full bg-zinc-950/80">
            <div className="p-3 border-b border-zinc-850/60 flex items-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Priority Inbox</span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {MOCK_EMAILS.map((mail, idx) => {
                const isSelected = idx === selectedMailIndex;
                return (
                  <div
                    key={mail.id}
                    onClick={() => setSelectedMailIndex(idx)}
                    className={`p-3 border-b border-zinc-850/40 cursor-pointer transition ${
                      isSelected ? "bg-indigo-950/20 border-l-2 border-l-indigo-500" : "hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`text-[10px] font-semibold truncate max-w-[80px] ${isSelected ? "text-indigo-400" : "text-zinc-350"}`}>
                        {mail.sender}
                      </span>
                      <span className="text-[8px] text-zinc-500">{mail.time}</span>
                    </div>
                    <div className="text-[9px] text-zinc-400 truncate font-medium">{mail.subject}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Detail Pane */}
          <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-zinc-850 flex justify-between items-start">
              <div>
                <h4 className="text-[11px] font-bold text-zinc-200">{activeMail.subject}</h4>
                <p className="text-[9px] text-zinc-400 mt-0.5">
                  From: <span className="text-zinc-300 font-semibold">{activeMail.sender}</span>
                </p>
              </div>
              <div className="text-[9px] text-zinc-500 font-mono">10:42 AM (2m ago)</div>
            </div>

            {/* Email Body */}
            <div className="p-4 flex-1 text-[11px] text-zinc-350 leading-relaxed font-normal bg-zinc-900 overflow-y-auto">
              <div className="border-l-2 border-indigo-500/30 pl-3 italic text-zinc-400 text-[10.5px] mb-3.5 leading-normal">
                &quot;{activeMail.body}&quot;
              </div>

              {/* Simulated Prompt Command Box */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-2.5 mb-3">
                <div className="flex items-center gap-1.5 mb-1 text-[8px] font-bold text-indigo-400 uppercase tracking-wide">
                  <Bot size={10} />
                  <span>DESCRIBE REPLY (AI AGENT COMMAND)</span>
                </div>
                <div className="font-mono text-[9.5px] text-zinc-200 min-h-[14px] flex items-center leading-normal">
                  <span>{typedPrompt}</span>
                  {isTypingPrompt && <span className="w-1 h-3.5 bg-indigo-500 animate-pulse ml-0.5" />}
                </div>
              </div>

              {/* Simulated AI Output Area */}
              {typedEmailText && (
                <div className="relative bg-zinc-950/40 border border-zinc-800/80 rounded-lg p-2.5 font-mono text-[9px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
                  <div className="absolute top-2 right-2 text-[7px] bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded uppercase font-semibold">
                    Gusion AI Draft
                  </div>
                  {typedEmailText}
                  {!isSent && !isTypingPrompt && <span className="inline-block w-1.5 h-3 bg-indigo-500 animate-pulse ml-0.5" />}
                </div>
              )}

              {isGeneratingEmail && (
                <div className="flex items-center gap-2 text-[9px] text-indigo-400 font-mono animate-pulse">
                  <Sparkles size={10} className="animate-spin" />
                  <span>Gusion AI drafting response...</span>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="px-4 py-3 border-t border-zinc-850 bg-zinc-950 flex items-center justify-between">
              <span className="text-[9px] text-zinc-500 font-mono select-none">Press Cmd+Enter to send</span>
              <div className="flex items-center gap-2">
                <AnimatePresence mode="wait">
                  {isSent ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-[9px] font-bold"
                    >
                      <CheckCircle size={11} />
                      <span>Sent Successfully</span>
                    </motion.div>
                  ) : (
                    <button
                      disabled={isTypingPrompt || isGeneratingEmail}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Send size={10} />
                      <span>Send Reply</span>
                    </button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Floating Metric Widgets (placed OUTSIDE the overflow-hidden container) */}
      <div className="absolute top-12 -left-6 w-[170px] bg-zinc-950/95 border border-zinc-850 rounded-xl p-3 shadow-2xl animate-bob1 z-20 hover:scale-105 transition-transform">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap size={11} className="text-indigo-400" />
          <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Response Speed</span>
        </div>
        <div className="font-mono text-lg font-bold text-zinc-150 leading-none">1.2s avg</div>
        <div className="text-[9px] text-zinc-400 mt-1">AI draft generation speed</div>
      </div>

      <div className="absolute -bottom-2 -right-2 w-[190px] bg-zinc-950/95 border border-zinc-850 rounded-xl p-3 shadow-2xl animate-bob2 z-20 hover:scale-105 transition-transform">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-500/10 border border-indigo-500/20 rounded-lg grid place-items-center text-indigo-400 shrink-0">
            🤖
          </div>
          <div>
            <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none">AI Agent Reply</div>
            <div className="text-[9px] text-zinc-300 font-semibold mt-1 truncate">draft generated in 0.3s</div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 -left-4 w-[160px] bg-zinc-950/95 border border-zinc-850 rounded-xl p-3 shadow-2xl animate-bob3 z-20 hover:scale-105 transition-transform hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1">
          <Keyboard size={11} className="text-indigo-400" />
          <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Shortcuts</span>
        </div>
        <div className="font-mono text-[10px] font-bold text-zinc-150 leading-none">J / K Navigation</div>
        <div className="text-[9px] text-zinc-400 mt-1">Navigate without mouse</div>
      </div>

    </div>
  );
}

/* ─── MAIN NEW LANDING PAGE ─── */
export function NewLanding() {
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fff2e0] text-zinc-800 font-sans antialiased overflow-x-hidden">
      
      {/* ─── NAVBAR ─── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100 transition-colors">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center no-underline text-wapi-ink shrink-0 relative">
              <Image src="/logo2.svg" alt="Gusion Mail Logo" width="150" height="34" priority />
              <span className="text-red-600 -top-4.5 relative text-base font-medium -ml-1">Mail</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {NAV_ITEMS.map((it) => (
                <Link
                  key={it.label}
                  href={it.href}
                  className="text-[13px] font-semibold text-zinc-500 hover:text-indigo-600 transition no-underline"
                >
                  {it.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => signIn("google")}
              className="hidden sm:inline-flex items-center text-[13px] font-semibold text-zinc-600 hover:text-indigo-600 transition cursor-pointer"
            >
              Log In
            </button>
            <button
              onClick={() => signIn("google")}
              className="px-4 py-2 rounded-full bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 hover:shadow-indigo-700/30 flex items-center gap-1 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight size={13} />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex flex-col gap-1 p-2 rounded-lg hover:bg-zinc-50 transition cursor-pointer"
              aria-label="Toggle Menu"
            >
              <span className={`block w-5 h-0.5 bg-zinc-600 rounded-full transition-transform ${mobileMenuOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`block w-5 h-0.5 bg-zinc-600 rounded-full transition-opacity ${mobileMenuOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-0.5 bg-zinc-600 rounded-full transition-transform ${mobileMenuOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-zinc-100 px-6 py-4 flex flex-col gap-3.5"
            >
              {NAV_ITEMS.map((it) => (
                <Link
                  key={it.label}
                  href={it.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-semibold text-zinc-600 hover:text-indigo-600 no-underline py-1.5 block border-b border-zinc-50 last:border-0"
                >
                  {it.label}
                </Link>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setMobileMenuOpen(false); void signIn("google"); }}
                  className="flex-1 text-center py-2.5 rounded-full border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Log In
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); void signIn("google"); }}
                  className="flex-1 text-center py-2.5 rounded-full bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative px-6 pt-16 pb-20 overflow-hidden bg-[#fff2e0]">
        {/* Soft Background Gradients */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_80%_20%,#EAF4EE,transparent_45%),radial-gradient(circle_at_20%_80%,#FFF5F5,transparent_45%)] opacity-80" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-16 items-center relative z-10">
          
          {/* Left Copy */}
          <div className="flex flex-col items-start text-left">
            <Link
              href="#bento"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 rounded-full text-xs text-zinc-600 mb-6 transition no-underline"
            >
              <span className="bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                New
              </span>
              <span>Morning Brief digest is now in beta →</span>
            </Link>

            <h1 className="font-bold text-[clamp(40px,5.5vw,72px)] leading-[0.98] tracking-tight text-[#012b57] mb-6">
              The AI-first email <br />
              client for <span className="text-indigo-600 italic">high-growth</span> teams.
            </h1>

            <p className="text-base sm:text-lg text-zinc-500 leading-relaxed max-w-[540px] mb-8 font-normal">
              Gusion Mail syncs with Gmail and Workspace to deliver speed. Draft complete replies in seconds, summarize long threads automatically, and manage contacts seamlessly in a beautiful, light interface.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => signIn("google")}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-bold bg-[#012b57] text-white hover:bg-indigo-600 transition shadow-lg hover:shadow-indigo-600/35 hover:-translate-y-0.5 group cursor-pointer"
              >
                <span>Connect Gmail Free</span>
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <Link
                href="#pricing"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 hover:-translate-y-0.5 transition no-underline cursor-pointer"
              >
                View Pricing Plans
              </Link>
            </div>

            {/* Badges Strip */}
            <div className="flex flex-wrap gap-3 items-stretch w-full pt-4 border-t border-zinc-150">
              {/* Trust Badge 1 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50/70 border border-zinc-200 rounded-xl animate-badge-glow transition-all hover:scale-[1.02] cursor-default">
                <div className="w-6 h-6 rounded-lg bg-green-500/10 grid place-items-center text-green-600 shrink-0">
                  <ShieldCheck size={13} />
                </div>
                <div className="leading-none text-left">
                  <div className="text-[11px] font-bold text-zinc-800">Secure OAuth</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">Google Verified App</div>
                </div>
              </div>

              {/* Trust Badge 2 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50/70 border border-zinc-200 rounded-xl animate-badge-glow [animation-delay:1.5s] transition-all hover:scale-[1.02] cursor-default">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 grid place-items-center text-indigo-600 shrink-0">
                  <Cpu size={13} />
                </div>
                <div className="leading-none text-left">
                  <div className="text-[11px] font-bold text-zinc-800">Local Privacy</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">Local cache indexing</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Inbox Mockup Simulator */}
          <div className="flex items-center justify-center relative px-4 sm:px-8">
            <InboxSimulator />
          </div>

        </div>
      </section>

      {/* ─── TRUSTED LOGO MARQUEE ─── */}
      <section className="bg-[#fff2e0] border-y border-zinc-150 py-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-5">
            BUILT WITH COMPATIBILITY IN MIND
          </p>
          <div className="relative w-full overflow-hidden">
            {/* Masking shadows left/right */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-linear-to-r from-zinc-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-linear-to-l from-zinc-50 to-transparent z-10 pointer-events-none" />
            
            <div className="flex gap-16 animate-marquee whitespace-nowrap">
              {[...COMPANYS, ...COMPANYS].map((company, i) => (
                <span
                  key={i}
                  className="font-bold text-lg sm:text-xl text-zinc-400 hover:text-indigo-600 transition cursor-default select-none"
                >
                  {company}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS STRIP ─── */}
      <section className="py-16 bg-[#fff2e0]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center flex flex-col items-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#012b57] tracking-tight mb-1">
                  {stat.value}
                </span>
                <span className="text-xs text-zinc-500 leading-normal max-w-[160px]">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── VALUE PILLARS (FEATURES GRID) ─── */}
      <section id="features" className="py-20 bg-zinc-50/50 border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
              Core Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#012b57] tracking-tight mt-4 mb-5">
              Powering your daily communication engine.
            </h2>
            <p className="text-sm sm:text-base text-zinc-500 leading-relaxed font-normal">
              Gusion Mail equips professionals with semantic AI workflows, zero-latency caching, and full calendar mapping.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className="bg-white border border-zinc-150 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50 hover:-translate-y-0.5 group flex flex-col"
                >
                  <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center shrink-0 mb-4`}>
                    <Icon size={18} className={p.iconColor} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-850 mb-2">{p.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed flex-1 font-normal">{p.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ─── BENTO GRID SECTION ─── */}
      <section id="bento" className="py-20 bg-[#fff2e0] border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full">
              Product Tour
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#012b57] tracking-tight mt-4 mb-4">
              Engineered for absolute focus.
            </h2>
            <p className="text-sm text-zinc-500 leading-normal font-normal">
              Explore key details that set Gusion Mail apart from traditional web clients.
            </p>
          </div>

          {/* Grid Template Areas styled via CSS grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[200px]">
            
            {/* Tile 1 — Command Palette */}
            <div className="md:col-span-2 bg-[#012b57] text-white rounded-2xl p-6 flex flex-col justify-between overflow-hidden relative shadow-lg">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div>
                <span className="text-[9px] font-bold tracking-wider uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Keyboard First
                </span>
                <h3 className="text-base sm:text-lg font-bold mt-3">The Cmd+K Command Palette</h3>
                <p className="text-xs text-zinc-300 max-w-sm mt-1 font-normal">
                  Control all settings, accounts, rules, and AI parameters instantly. Press J/K keys to scroll through threads.
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 flex items-center gap-2 font-mono text-[9px] text-zinc-300 max-w-[280px]">
                <Command size={11} className="text-indigo-400" />
                <span>type <b className="text-white">&quot;brief&quot;</b> to compile summaries</span>
              </div>
            </div>

            {/* Tile 2 — Split Inbox */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Layers size={14} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-zinc-850">Dynamic Split Inbox</h3>
                <p className="text-xs text-zinc-500 mt-1 font-normal">
                  Sort transactions, marketing notifications, and personal correspondence automatically.
                </p>
              </div>
            </div>

            {/* Tile 3 — hosted in Mumbai */}
            <div className="bg-purple-50/40 border border-purple-200/80 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
              <div className="text-2xl select-none">🇮🇳</div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-zinc-850">100% Data Residency</h3>
                <p className="text-xs text-zinc-500 mt-1 font-normal">
                  Local cache architecture ensures your database remains hosted securely within India, compliant with DPDP guidelines.
                </p>
              </div>
            </div>

            {/* Tile 4 — Developer API */}
            <div className="md:col-span-2 bg-zinc-950 border border-zinc-850 rounded-2xl p-6 flex flex-col justify-between font-mono overflow-hidden relative shadow-lg text-left">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-center pb-2 border-b border-zinc-850/60">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Code size={11} className="text-purple-400" />
                  <span>Developer Sync API</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                  <span>POST /v1/drafts</span>
                </div>
              </div>
              <pre className="text-[10px] text-zinc-300 leading-normal flex-1 pt-3">
                <code>
                  <span className="text-purple-400">await</span> gusion.inbox.createDraft{"({"}<br />
                  {"  "}to: <span className="text-yellow-500">&quot;priya@desai.com&quot;</span>,<br />
                  {"  "}prompt: <span className="text-yellow-500">&quot;Accept sync, limit to 15m&quot;</span><br />
                  {"})"}{";"}
                </code>
              </pre>
              <div className="text-[9px] text-zinc-500 mt-2">Fully documented OpenAPI endpoint triggers.</div>
            </div>

          </div>

        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-20  border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 text-center">
          
          <div className="max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
              Process Flow
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#012b57] tracking-tight mt-4 mb-4">
              Get set up in less than 2 minutes.
            </h2>
            <p className="text-sm text-zinc-500 font-normal">
              No complex onboarding flow. Authenticate securely and start optimizing your workflow immediately.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-bold text-zinc-700 shadow-md mb-4">
                1
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-850 mb-2">Google Secure Sign-In</h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed max-w-[240px] font-normal">
                Authenticate securely using Gmail OAuth scopes. We never store credentials locally.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-bold text-zinc-700 shadow-md mb-4">
                2
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-850 mb-2">Configure Workspace Rules</h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed max-w-[240px] font-normal">
                Set up priority categories and define AI tone settings (formal, casual, concise).
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center font-bold text-zinc-700 shadow-md mb-4">
                3
              </div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-850 mb-2">Navigate 10x Faster</h3>
              <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed max-w-[240px] font-normal">
                Manage correspondence instantly using command palettes and contextual drafts.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─── COMPARISON CARD ─── */}
      <section className="py-20 bg-[#fff2e0] border-t border-zinc-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-zinc-950 text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-center mb-8">
              Why switch to Gusion Mail?
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Traditional */}
              <div className="border-b md:border-b-0 md:border-r border-zinc-800 pb-8 md:pb-0 md:pr-8">
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                  Traditional Email Clients
                </span>
                <ul className="mt-4 flex flex-col gap-3">
                  {[
                    "Mouse-dependent interface slows down processing",
                    "Requires copy-pasting drafts to third-party tools",
                    "Cluttered search query interface",
                    "Siloed browser tabs for calendar scheduling"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-400 font-normal">
                      <span className="text-red-500 font-bold shrink-0">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right Column: Gusion */}
              <div className="pt-4 md:pt-0">
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">
                  Gusion Mail Workspace
                </span>
                <ul className="mt-4 flex flex-col gap-3">
                  {[
                    "Keyboard-driven shortcuts keep hands on home row",
                    "AI agent drafts contextually inside the workspace",
                    "Zero-latency indexing for instant search result loads",
                    "Insert calendar slot proposals inside the draft directly"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-200 font-normal">
                      <span className="text-green-400 font-bold shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── PRICING PLANS ─── */}
      <section id="pricing" className="py-20  border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
              Pricing Details
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#012b57] tracking-tight mt-4 mb-4">
              Predictable, value-driven plans.
            </h2>
            <p className="text-sm text-zinc-500 font-normal">
              Select a tier that scales with your growth. All billing includes secure payment pathways.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            
            {/* Plan 1 */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Free Tier</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-3xl font-extrabold text-zinc-900">₹0</span>
                  <span className="text-xs text-zinc-500 ml-1">/ seat / month</span>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-6 font-normal">Basic inbox layout with Gmail account sync.</p>
              <ul className="flex-1 flex flex-col gap-2.5 mb-6 text-xs text-zinc-500 font-normal">
                {["1 Linked Account", "Standard AI Smart Reply (50/mo)", "Keyboard Shortcuts enabled", "Basic Search indexing"].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => signIn("google")}
                className="w-full py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 transition cursor-pointer"
              >
                Start Free
              </button>
            </div>

            {/* Plan 2 — Pro (Featured) */}
            <div className="bg-white border-2 border-indigo-600 rounded-2xl p-6 shadow-xl relative flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Recommended
              </div>
              <div className="mb-4 mt-2">
                <h3 className="text-sm font-bold text-[#012b57] uppercase tracking-wider">Pro License</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-3xl font-extrabold text-zinc-900">₹1,699</span>
                  <span className="text-xs text-zinc-500 ml-1">/ seat / month</span>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-6 font-normal">Advanced semantic agent draft features for power users.</p>
              <ul className="flex-1 flex flex-col gap-2.5 mb-6 text-xs text-zinc-500 font-normal">
                {[
                  "Unlimited Google Accounts",
                  "Unlimited AI Smart Reply drafts",
                  "Daily morning summary brief digests",
                  "Google Calendar scheduling blocks",
                  "Priority support SLA (12 hours)",
                  "GST Compliant billing"
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                    <span className="text-zinc-800">{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => signIn("google")}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold transition shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                Go Pro License
              </button>
            </div>

            {/* Plan 3 */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Team Server</h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-3xl font-extrabold text-zinc-900">₹2,199</span>
                  <span className="text-xs text-zinc-500 ml-1">/ seat / month</span>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-6 font-normal">Collaborative priority feeds built for support desks.</p>
              <ul className="flex-1 flex flex-col gap-2.5 mb-6 text-xs text-zinc-500 font-normal">
                {[
                  "Everything in Pro Tier",
                  "Shared inbox delegation",
                  "Shared draft approvals workspace",
                  "Central team settings / workspace rules",
                  "SSO / SAML authentications",
                  "Dedicated manager support"
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-indigo-600 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => signIn("google")}
                className="w-full py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 transition cursor-pointer"
              >
                Configure Team
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* ─── FAQ SECTION ─── */}
      <section id="faq" className="py-20 bg-[#fff2e0] border-t border-zinc-100">
        <div className="max-w-3xl mx-auto px-6">
          
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-purple-600 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full">
              Questions
            </span>
            <h2 className="text-3xl font-bold text-[#012b57] tracking-tight mt-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFAQ === idx;
              return (
                <div
                  key={idx}
                  className="border border-zinc-150 rounded-2xl overflow-hidden transition-colors bg-white hover:border-zinc-250"
                >
                  <button
                    onClick={() => setActiveFAQ(isOpen ? null : idx)}
                    className="w-full px-6 py-4 flex items-center justify-between font-bold text-[#012b57] text-left text-sm cursor-pointer select-none bg-zinc-50/30"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={16}
                      className={`text-zinc-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <div className="px-6 pb-5 pt-1 text-xs sm:text-sm leading-relaxed text-zinc-500 font-normal">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-20 bg-indigo-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#0056d6_0%,transparent_50%),radial-gradient(circle_at_80%_80%,#e61f2a_0%,transparent_50%)] opacity-30" />
        
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[#ffffff]">
            Reclaim your inbox speed today.
          </h2>
          <p className="text-sm text-zinc-300 leading-normal max-w-lg mx-auto mb-8 font-normal">
            Link your Gmail or Workspace domain in 1 click. Start checking, prioritizing, drafting, and scheduling contextually.
          </p>
          <button
            onClick={() => signIn("google")}
            className="px-7 py-4 rounded-full bg-white text-[#012b57] hover:bg-zinc-100 text-sm font-bold transition shadow-2xl hover:scale-[1.01] cursor-pointer"
          >
            Connect My Gmail Now
          </button>
          <div className="flex justify-center gap-5 text-[11px] text-zinc-400 mt-6 font-normal">
            <span>✓ Secure Google OAuth</span>
            <span>✓ No credit card required</span>
            <span>✓ Standard 14-day Pro trial</span>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t-[3px] border-[#fff2e0] py-4 relative overflow-hidden bg-[#fff2e0]">
        {/* Red/Blue Divider Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-[#e61f2a] via-[#0067ff] to-[#e61f2a]" />
        
        <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 py-10 text-xs sm:text-sm text-zinc-500">
          {/* Logo Column */}
          <div className="flex flex-col items-start text-left">
            
            <Link href="/" className="flex items-center no-underline text-wapi-ink shrink-0 relative mb-4">
              <Image src="/logo2.svg" alt="Gusion Mail Logo" width="150" height="34" priority />
              <span className="text-red-600 -top-4.5 relative text-base font-medium -ml-1">Mail</span>
            </Link>
            <p className="text-xs text-zinc-500 leading-relaxed font-normal max-w-[200px]">
              The secure, keyboard-first AI email workspace built for modern professionals.
            </p>
          </div>

          {/* Column 2 */}
          <div className="text-left">
            <h3 className="font-bold text-zinc-900 mb-3">Integrations</h3>
            <ul className="flex flex-col gap-2 font-normal text-xs text-zinc-650">
              <li>Gmail API sync</li>
              <li>Google Calendar API</li>
              <li>Workspace Domain delegate</li>
              <li>OAuth2 Authentication scopes</li>
            </ul>
          </div>

          {/* Column 3 */}
          <div className="text-left">
            <h3 className="font-bold text-zinc-900 mb-3">Security & Laws</h3>
            <ul className="flex flex-col gap-2 font-normal text-xs text-zinc-650">
              <li>100% Mumbai Cloud hosting</li>
              <li>DPDP Privacy Guard compliant</li>
              <li>No email storage architecture</li>
              <li>Local cache DB encryption</li>
            </ul>
          </div>

          {/* Column 4 */}
          <div className="text-left">
            <h3 className="font-bold text-zinc-900 mb-3">Contact Us</h3>
            <p className="text-xs leading-normal mb-3 font-normal text-zinc-650">
              Need custom integrations or corporate team workspace hosting?
            </p>
            <button
              onClick={() => signIn("google")}
              className="inline-flex items-center gap-1 bg-[#0067ff] hover:bg-[#0052cc] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition cursor-pointer"
            >
              <span>Book Enterprise Demo</span>
              <ExternalLink size={10} />
            </button>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="border-t border-zinc-200/50 max-w-[1280px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400 font-normal">
          <span>© {new Date().getFullYear()} Gusion Mail. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-zinc-600 transition no-underline">Terms</Link>
            <Link href="/privacy" className="hover:text-zinc-600 transition no-underline">Privacy</Link>
            <Link href="/privacy#dpdp" className="hover:text-zinc-600 transition no-underline">DPDP</Link>
            <Link href="/privacy#security" className="hover:text-zinc-600 transition no-underline">Security</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
