"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Keyboard,
  Cpu,
  Zap,
  ShieldCheck,
  Calendar,
  Mail,
  Sparkles,
  MessageSquare,
  Clock,
  Search,
  FileText,
  BellRing,
  ArrowRight,
  Check,
  ChevronDown,
  Command,
  Star,
  Users,
  Bot,
  Send,
  Sunrise,
  Link2,
  Layers,
  Timer,
  MailPlus,
} from "lucide-react";

/* ─── animation helpers ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── data ─── */
const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const PILLARS = [
  {
    icon: Keyboard,
    color: "from-indigo-500 to-indigo-600",
    bg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    title: "Superhuman Speed",
    desc: "Archive, reply, snooze, or navigate your entire inbox without touching a mouse. Cmd+K command palette, J/K navigation, and optimistic UI that feels instant.",
  },
  {
    icon: Bot,
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    iconColor: "text-violet-600",
    title: "AI That Actually Works",
    desc: 'Say "invite Sarah Thursday 9am and email her I\'m looking forward to it" — and it\'s done. Priority inbox, smart replies, thread summaries, and a daily brief.',
  },
  {
    icon: Calendar,
    color: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    title: "Scheduling Built In",
    desc: "Day, week, and month calendar views. Share public booking links (like Calendly), create events from natural language, and invite attendees in one keystroke.",
  },
];

const FEATURES = [
  {
    icon: Layers,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    title: "Split Inbox & Smart Triage",
    desc: "Your inbox, organized by AI. Important messages rise to the top. Newsletters, updates, and noise get sorted automatically. Archive, snooze, or star in one keystroke with instant undo.",
    bullets: [
      "AI-powered priority badges (Urgent / Important / FYI)",
      "Smart views: Important, Other, VIP, Newsletters",
      "One-key archive, star, snooze & undo send",
      "Optimistic UI — every action feels instant",
    ],
  },
  {
    icon: Bot,
    color: "text-violet-600",
    bg: "bg-violet-50",
    title: "AI Agent Chat",
    desc: 'The flagship feature. Talk to your inbox in plain English. "Draft a follow-up to the budget thread," "find a time with the team next week," or "send a polite decline." The agent proposes actions, you confirm.',
    bullets: [
      "Natural language → real email & calendar actions",
      "Multi-step workflows in a single conversation",
      "Propose-then-confirm safety gate",
      "Full audit log of every AI action",
    ],
  },
  {
    icon: Sparkles,
    color: "text-amber-600",
    bg: "bg-amber-50",
    title: "AI Compose & Smart Reply",
    desc: "Write emails in seconds, not minutes. Describe what you want to say and the AI drafts it in your tone. Or pick from instant smart reply suggestions on any incoming email.",
    bullets: [
      '"Write with AI" — describe, draft, send',
      "Tone matching from your writing history",
      "1-click smart reply suggestions",
      "Thread TL;DR summaries for long conversations",
    ],
  },
  {
    icon: Sunrise,
    color: "text-orange-600",
    bg: "bg-orange-50",
    title: '"Catch Me Up" Daily Brief',
    desc: "Start every morning knowing exactly what needs your attention. An AI-generated digest of urgent messages, pending follow-ups, and today's calendar — delivered the moment you open your inbox.",
    bullets: [
      "Morning digest of what matters",
      "Urgent messages & pending replies highlighted",
      "Today's calendar at a glance",
      "Powered by Google Gemini",
    ],
  },
  {
    icon: Link2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    title: "Scheduling & Booking Links",
    desc: "Share a personal booking page — like Calendly, but built right into your email client. Recipients pick a time from your real availability. The event and confirmation happen automatically.",
    bullets: [
      "Public /book/you page with real-time availability",
      "Automatic event creation & invite emails",
      "Natural language: \"lunch with Sam Friday 1pm\"",
      "Time-zone intelligence built in",
    ],
  },
  {
    icon: Command,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "Command Palette & Shortcuts",
    desc: "Hit Cmd+K and do anything — search, compose, navigate, change settings. Every action in the app has a keyboard shortcut. Power users will feel right at home.",
    bullets: [
      "Cmd+K opens a universal command bar",
      "J/K to move, E to archive, C to compose, R to reply",
      "Shortcut coaching for new users",
      "Interactive tutorial on first launch",
    ],
  },
  {
    icon: FileText,
    color: "text-pink-600",
    bg: "bg-pink-50",
    title: "Templates & Snippets",
    desc: "Stop rewriting the same email. Create templates with dynamic variables ({{name}}, {{company}}) and expand them with a keyboard shortcut. Share them across your team.",
    bullets: [
      "Variable expansion ({{name}}, {{date}}, ...)",
      "Keyboard-triggered insertion",
      "Shared template library for teams",
      "Works in compose & smart reply",
    ],
  },
  {
    icon: Timer,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    title: "Snooze, Send Later & Follow-Ups",
    desc: "Control when email happens. Snooze a message to resurface later. Schedule a send for the perfect time. Get reminded if someone doesn't reply in 3 days.",
    bullets: [
      "Snooze to any date/time",
      "Schedule send for later",
      "Follow-up nudges on no-reply",
      "All powered by background job queues",
    ],
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Get started with the essentials",
    cta: "Start Free",
    features: [
      "1 Gmail account",
      "Split inbox & smart views",
      "Calendar views",
      "Cmd+K command palette",
      "Full keyboard shortcuts",
      "Snooze & VIP contacts",
      "Limited AI priority",
    ],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$20",
    period: "/month",
    desc: "Everything for power users",
    cta: "Start 14-Day Free Trial",
    features: [
      "Everything in Free",
      "AI Agent Chat",
      "AI Compose & Smart Reply",
      "Thread Summaries",
      "Daily Brief",
      "Scheduling links",
      "Send Later & Follow-ups",
      "Templates & snippets",
      "Multi-account support",
      "Bulk mail-merge",
    ],
    highlight: true,
  },
  {
    name: "Team",
    price: "$25",
    period: "/seat/month",
    desc: "Shared inbox & support tickets",
    cta: "Contact Us",
    features: [
      "Everything in Pro",
      "Shared inbox (support@)",
      "Support ticket IDs (GSN-####)",
      "Assignment & internal notes",
      "Automation engine",
      "Shared template library",
      "Team analytics",
      "Admin roles & controls",
    ],
    highlight: false,
  },
];

const FAQS = [
  {
    q: "What email providers do you support?",
    a: "Gusion Mail currently supports Gmail (Google Workspace and personal). We connect securely through Google's official OAuth — your password is never stored. Outlook and IMAP support are on the roadmap.",
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. Every user gets an isolated tenant with encrypted OAuth tokens. We use scoped Google API permissions (minimum required), and all email HTML is sanitized before rendering. You can export your data or delete your account at any time.",
  },
  {
    q: "How does the 14-day trial work?",
    a: "Sign up and get full Pro access for 14 days — AI Agent, scheduling links, smart replies, everything. No card required to start. At the end of the trial you can continue on the Free plan or upgrade.",
  },
  {
    q: "What AI model powers Gusion?",
    a: "We use Google's Gemini models. Lightweight classification models for priority inbox (fast and cheap), and the latest Gemini for AI compose, smart replies, and the Agent Chat.",
  },
  {
    q: "Can I really use only my keyboard?",
    a: "Yes! Every action has a keyboard shortcut — J/K to navigate, E to archive, C to compose, R to reply, Cmd+K for the command palette. We even have an interactive tutorial to get you up to speed in minutes.",
  },
  {
    q: "How is this different from Superhuman?",
    a: "Same keyboard-first speed philosophy, but with a built-in AI agent that can execute multi-step workflows, integrated scheduling links (no Calendly needed), and pricing that won't break the bank. Plus, team features with shared inboxes and support tickets.",
  },
];

/* ─── component ─── */
export function NewLanding() {
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenu(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-zinc-900 selection:bg-indigo-200 selection:text-indigo-900 overflow-x-hidden">
      {/* ─── NAV ─── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border-b border-zinc-200/60"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-indigo-500/20">
              G
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-900">
              Gusion Mail
            </span>
          </div>

          {/* desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href.slice(1))}
                className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition cursor-pointer"
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* cta */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => signIn("google")}
              className="hidden sm:inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-900 transition cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => signIn("google")}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 rounded-lg shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              Get Started Free
            </button>

            {/* mobile hamburger */}
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="md:hidden ml-1 p-2 text-zinc-600 hover:text-zinc-900 cursor-pointer"
              aria-label="Menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                {mobileMenu ? (
                  <path d="M5 5l10 10M15 5L5 15" />
                ) : (
                  <path d="M3 6h14M3 10h14M3 14h14" />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {/* mobile menu */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white/95 backdrop-blur-xl border-b border-zinc-200/60 overflow-hidden"
            >
              <div className="px-6 py-4 flex flex-col gap-3">
                {NAV_LINKS.map((l) => (
                  <button
                    key={l.href}
                    onClick={() => scrollTo(l.href.slice(1))}
                    className="text-sm font-medium text-zinc-600 hover:text-zinc-900 text-left cursor-pointer"
                  >
                    {l.label}
                  </button>
                ))}
                <button
                  onClick={() => signIn("google")}
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 text-left cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        {/* soft ambient blobs */}
        <div className="absolute top-16 left-1/4 w-[480px] h-[480px] bg-indigo-100/60 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 right-1/4 w-[560px] h-[560px] bg-violet-100/50 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          {/* badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-600 mb-8"
          >
            <Zap size={12} className="animate-pulse" />
            <span>Now in Public Trial — 14 Days Free</span>
          </motion.div>

          {/* headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-zinc-900 max-w-4xl mx-auto leading-[1.1] mb-6"
          >
            The AI command center for{" "}
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
              email & calendar
            </span>
          </motion.h1>

          {/* subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg md:text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Triage your inbox at the speed of thought. Let AI draft replies,
            summarize threads, and run your scheduling — all from a keyboard-first
            console powered by Google Gemini.
          </motion.p>

          {/* cta buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <button
              onClick={() => signIn("google")}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 text-base"
            >
              <span>Start Free — 14 Day Trial</span>
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => scrollTo("features")}
              className="w-full sm:w-auto px-8 py-4 bg-white border border-zinc-200 text-zinc-700 font-semibold rounded-xl shadow-sm hover:shadow-md hover:border-zinc-300 transition-all hover:-translate-y-0.5 cursor-pointer text-base"
            >
              See Features
            </button>
          </motion.div>

          {/* hero image */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-5xl mx-auto"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-zinc-900/10 border border-zinc-200/80">
              <img
                src="/hero-dashboard.png"
                alt="Gusion Mail dashboard — three-pane inbox with AI priority badges, command palette, and calendar"
                className="w-full h-auto"
                loading="eager"
              />
              {/* soft overlay gradient at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FAFAF9] to-transparent pointer-events-none" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <section className="py-12 border-y border-zinc-100">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-zinc-400 font-medium">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              Encrypted & Isolated Tenants
            </span>
            <span className="flex items-center gap-2">
              <Cpu size={16} className="text-violet-500" />
              Powered by Google Gemini
            </span>
            <span className="flex items-center gap-2">
              <Star size={16} className="text-amber-500" />
              Built for Founders, Execs & Power Users
            </span>
            <span className="flex items-center gap-2">
              <Users size={16} className="text-blue-500" />
              Team & Enterprise Ready
            </span>
          </FadeIn>
        </div>
      </section>

      {/* ─── THREE PILLARS ─── */}
      <section id="features" className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-3">
              Why switch
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
              Everything you need. Nothing you don&apos;t.
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {PILLARS.map((p, i) => (
              <FadeIn key={p.title} delay={i * 0.1}>
                <div className="group relative p-8 rounded-2xl bg-white border border-zinc-100 shadow-sm hover:shadow-lg hover:border-zinc-200 transition-all hover:-translate-y-1 h-full">
                  <div
                    className={`w-12 h-12 rounded-xl ${p.bg} flex items-center justify-center ${p.iconColor} mb-5`}
                  >
                    <p.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 mb-3">
                    {p.title}
                  </h3>
                  <p className="text-zinc-500 leading-relaxed text-[15px]">
                    {p.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURE DEEP-DIVES ─── */}
      <section className="py-24 md:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="text-center mb-20">
            <p className="text-sm font-semibold text-violet-600 tracking-wide uppercase mb-3">
              Features
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
              Every feature, actually explained
            </h2>
            <p className="text-zinc-500 max-w-xl mx-auto">
              Not just bullet points. Here&apos;s what each feature does, why it
              matters, and how it works.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-8">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={(i % 2) * 0.1}>
                <div className="group p-8 rounded-2xl bg-[#FAFAF9] border border-zinc-100 hover:border-zinc-200 hover:shadow-md transition-all h-full">
                  <div className="flex items-start gap-4 mb-5">
                    <div
                      className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center ${f.color} shrink-0`}
                    >
                      <f.icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 mb-1">
                        {f.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-zinc-500 text-[15px] leading-relaxed mb-5">
                    {f.desc}
                  </p>
                  <ul className="space-y-2.5">
                    {f.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2.5 text-sm text-zinc-600"
                      >
                        <Check
                          size={16}
                          className="text-emerald-500 mt-0.5 shrink-0"
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AI SHOWCASE BANNER ─── */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-200/30 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-indigo-100 shadow-sm text-sm font-semibold text-indigo-600 mb-8">
              <Sparkles size={16} />
              Powered by Google Gemini
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-6">
              &ldquo;Invite the team Thursday 2pm and email everyone the
              agenda.&rdquo;
            </h2>
            <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed mb-10">
              The AI Agent understands multi-step requests across email and
              calendar. It proposes each action, you confirm with one click, and
              it&apos;s done. No switching apps, no copy-paste, no friction.
            </p>
            <button
              onClick={() => signIn("google")}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5 cursor-pointer inline-flex items-center gap-2"
            >
              Try the AI Agent
              <ArrowRight size={18} />
            </button>
          </FadeIn>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-24 md:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-3">
              Pricing
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-zinc-500">
              Start free. Upgrade when you&apos;re ready.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.1}>
                <div
                  className={`relative p-8 rounded-2xl border h-full flex flex-col ${
                    plan.highlight
                      ? "bg-gradient-to-b from-indigo-50/50 to-white border-indigo-200 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-100"
                      : "bg-white border-zinc-100 shadow-sm"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-bold rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-zinc-900 mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-zinc-500 text-sm mb-4">{plan.desc}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-zinc-900">
                        {plan.price}
                      </span>
                      <span className="text-zinc-400 text-sm font-medium">
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 text-sm text-zinc-600"
                      >
                        <Check
                          size={16}
                          className={`mt-0.5 shrink-0 ${
                            plan.highlight
                              ? "text-indigo-500"
                              : "text-emerald-500"
                          }`}
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => signIn("google")}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                      plan.highlight
                        ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-3">
              FAQ
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
              Frequently asked questions
            </h2>
          </FadeIn>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <div className="rounded-2xl border border-zinc-100 bg-white overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer group"
                  >
                    <span className="font-semibold text-zinc-900 text-[15px] pr-4">
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-zinc-400 transition-transform shrink-0 ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-5 text-zinc-500 text-[15px] leading-relaxed border-t border-zinc-50 pt-4">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-violet-50/60 to-[#FAFAF9] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-6">
              Ready to take control of your inbox?
            </h2>
            <p className="text-lg text-zinc-500 max-w-xl mx-auto leading-relaxed mb-10">
              Join the public trial. Connect your Gmail, meet the AI, and
              experience email the way it should be.
            </p>
            <button
              onClick={() => signIn("google")}
              className="px-10 py-4 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5 cursor-pointer inline-flex items-center gap-2 text-lg"
            >
              Get Started Free
              <ArrowRight size={20} />
            </button>
            <p className="mt-4 text-sm text-zinc-400">
              14-day Pro trial · No credit card required
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
                G
              </div>
              <span className="font-bold text-sm text-zinc-900">
                Gusion Mail
              </span>
            </div>

            {/* links */}
            <div className="flex items-center gap-6 text-sm text-zinc-400">
              <a
                href="/privacy"
                className="hover:text-zinc-600 transition"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="hover:text-zinc-600 transition"
              >
                Terms
              </a>
              <a
                href="/docs"
                className="hover:text-zinc-600 transition"
              >
                API Docs
              </a>
            </div>

            {/* copyright */}
            <p className="text-xs text-zinc-400">
              © {new Date().getFullYear()} Gusion Mail. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
