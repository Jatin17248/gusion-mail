"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  CalendarIcon,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  Settings,
  Clock,
  LogOut,
  Sun,
  Moon,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/trpc/react";
import { useDashboard } from "@/app/dashboard/_context/dashboard-context";

interface SidebarProps {
  agentOpen: boolean;
  setAgentOpen: (open: boolean) => void;
  session: any;
  trialDaysRemaining: number;
}

export function Sidebar({
  setAgentOpen,
  session,
  trialDaysRemaining,
}: SidebarProps) {
  const pathname = usePathname();
  const { openUpgrade } = useDashboard();
  const { data: subscription } = api.billing.getSubscription.useQuery(undefined, {
    staleTime: 60000,
  });
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isLight = !document.documentElement.classList.contains("dark");
    setTheme(isLight ? "light" : "dark");
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    }
  };

  const navItems = [
    {
      href: "/dashboard",
      label: "AI Agent",
      icon: Sparkles,
      exact: true,
      onClick: undefined as (() => void) | undefined,
    },
    {
      href: "/dashboard/inbox",
      label: "Emails",
      icon: Mail,
      exact: false,
      onClick: undefined as (() => void) | undefined,
    },
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      icon: CalendarIcon,
      exact: false,
      onClick: undefined as (() => void) | undefined,
    },
    {
      href: "/dashboard/tickets",
      label: "Support Queue",
      icon: HelpCircle,
      exact: false,
      onClick: () => setAgentOpen(false),
    },
    {
      href: "/dashboard/bulk",
      label: "Bulk Campaign",
      icon: FileSpreadsheet,
      exact: false,
      onClick: () => setAgentOpen(false),
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      icon: Settings,
      exact: false,
      onClick: () => setAgentOpen(false),
    },
  ];

  return (
    <aside className="w-52 shrink-0 border-r border-zinc-900 bg-zinc-900/10 flex flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2">
          <Image
            src="/images/logoWhite.svg"
            alt="Gusion Mail"
            className="hidden dark:block h-13 w-48"
            width={32}
            height={32}
          />
          <Image
            src="/images/logodark.svg"
            alt="Gusion Mail"
            className="dark:hidden block h-13 w-48"
            width={32}
            height={32}
          />
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={item.onClick}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
                  isActive
                    ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer info: Trial and Sign Out */}
      <div className="space-y-4">
        {(() => {
          const isPro =
            subscription?.plan === "pro" && subscription?.status === "active";
          const daysLeft = subscription?.trialDaysRemaining ?? trialDaysRemaining;

          if (isPro) {
            return (
              <div className="p-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <ShieldCheck size={12} />
                  <span>Pro plan active</span>
                </div>
              </div>
            );
          }

          const expired = daysLeft <= 0;
          return (
            <div
              className={`p-3 rounded-lg border backdrop-blur-sm ${
                expired
                  ? "border-rose-500/20 bg-rose-500/5"
                  : "border-indigo-500/10 bg-indigo-500/5"
              }`}
            >
              <div
                className={`flex items-center gap-2 text-xs font-semibold mb-1 ${
                  expired ? "text-rose-400" : "text-indigo-400"
                }`}
              >
                <Clock size={12} />
                <span>{expired ? "Trial ended" : "Trial Active"}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mb-2">
                {expired
                  ? "Upgrade to keep using AI features and automations."
                  : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining. Accessing all Pro features.`}
              </p>
              <button
                onClick={() => openUpgrade()}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition cursor-pointer"
              >
                <Zap size={12} />
                Upgrade to Pro
              </button>
            </div>
          );
        })()}

        <div className="flex items-center justify-between border-t border-zinc-900 pt-4 px-2">
          <div className="flex items-center gap-2 min-w-0">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Google avatar; next/image would require remote-domain config
              <img
                src={session.user.image}
                alt={session.user.name ?? ""}
                className="w-7 h-7 rounded-full border border-zinc-800"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">
                {session?.user?.name?.[0]}
              </div>
            )}
            <span className="text-xs font-medium text-zinc-300 truncate">{session?.user?.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {mounted && (
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign Out"
              className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
