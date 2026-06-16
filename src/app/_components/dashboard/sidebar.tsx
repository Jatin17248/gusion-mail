import {
  Mail,
  CalendarIcon,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  Settings,
  Clock,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";

interface SidebarProps {
  activeTab: "tickets" | "gmail" | "calendar" | "bulk" | "settings";
  setActiveTab: (tab: "tickets" | "gmail" | "calendar" | "bulk" | "settings") => void;
  agentOpen: boolean;
  setAgentOpen: (open: boolean) => void;
  session: any;
  trialDaysRemaining: number;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  agentOpen,
  setAgentOpen,
  session,
  trialDaysRemaining,
}: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-zinc-900 bg-zinc-900/10 flex flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg">
            G
          </div>
          <span className="font-bold text-md tracking-tight text-zinc-100">Gusion Mail</span>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab("gmail")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
              activeTab === "gmail"
                ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Mail size={16} />
            <span>Emails</span>
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
              activeTab === "calendar"
                ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <CalendarIcon size={16} />
            <span>Calendar</span>
          </button>
          <button
            onClick={() => {
              setAgentOpen(!agentOpen);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
              agentOpen
                ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Sparkles size={16} />
            <span>AI Agent</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("tickets");
              setAgentOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
              activeTab === "tickets"
                ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <HelpCircle size={16} />
            <span>Support Queue</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("bulk");
              setAgentOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
              activeTab === "bulk"
                ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <FileSpreadsheet size={16} />
            <span>Bulk Campaign</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("settings");
              setAgentOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition cursor-pointer ${
              activeTab === "settings"
                ? "bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Footer info: Trial and Sign Out */}
      <div className="space-y-4">
        <div className="p-3 rounded-lg border border-indigo-500/10 bg-indigo-500/5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-1">
            <Clock size={12} />
            <span>Trial Active</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            {trialDaysRemaining} days remaining in trial. Accessing all Pro features.
          </p>
        </div>

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
          <button
            onClick={() => signOut()}
            title="Sign Out"
            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
