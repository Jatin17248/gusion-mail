import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Inbox, Calendar, FileText, HelpCircle, Archive, Eye, Sparkles, Filter, Search, Settings, Bookmark, Clock } from "lucide-react";
import { api } from "@/trpc/react";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAction: (action: string, payload?: string) => void;
}

export function CommandPalette({ open, setOpen, onAction }: CommandPaletteProps) {
  const [value, setValue] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { data: savedSearches } = api.search.listSavedSearches.useQuery(undefined, { enabled: open });

  useEffect(() => {
    try {
      setRecentSearches(JSON.parse(localStorage.getItem("recent_searches") || "[]"));
    } catch {}
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  // Reset input when opening
  useEffect(() => {
    if (open) {
      setValue("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-zinc-950/60 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-md">
        <Command label="Global Command Menu" className="w-full">
          <div className="flex items-center border-b border-zinc-800 px-3 gap-2">
            <Search className="h-4 w-4 text-zinc-500 flex-shrink-0" />
            <Command.Input
              value={value}
              onValueChange={setValue}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim()) {
                  // If it's a command search or custom query filter, execute search
                  e.preventDefault();
                  onAction("search", value);
                  setOpen(false);
                }
              }}
              placeholder="Search commands or mail (e.g. '/from:john', '/subject:invoice')..."
              className="flex h-12 w-full bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>
          <Command.List className="max-h-[350px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-zinc-500">
              No results found. Press <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded text-xs">Enter</kbd> to search mail for &ldquo;{value}&rdquo;.
            </Command.Empty>
            
            {/* Show Quick Action to search what they typed */}
            {value.trim() && (
              <Command.Group heading="Execute Search">
                <Command.Item
                  onSelect={() => {
                    onAction("search", value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-400 rounded-md cursor-pointer hover:bg-zinc-800"
                >
                  <Search size={16} />
                  <span>Search mail for &ldquo;{value}&rdquo;</span>
                </Command.Item>
              </Command.Group>
            )}

            {savedSearches && savedSearches.length > 0 && (
              <>
                <Command.Group heading="Saved Searches" className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {savedSearches.map((search) => (
                    <Command.Item
                      key={search.id}
                      onSelect={() => {
                        onAction("search", search.query);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
                    >
                      <Bookmark size={14} className="text-zinc-500" />
                      <span>{search.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
                <div className="my-1 border-t border-zinc-800" />
              </>
            )}

            {recentSearches.length > 0 && (
              <>
                <Command.Group heading="Recent Searches" className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {recentSearches.map((query, idx) => (
                    <Command.Item
                      key={`recent-${idx}`}
                      onSelect={() => {
                        onAction("search", query);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
                    >
                      <Clock size={14} className="text-zinc-500" />
                      <span>{query}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
                <div className="my-1 border-t border-zinc-800" />
              </>
            )}

            <Command.Group heading="Email Search Filters" className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <Command.Item
                onSelect={() => setValue("/from:")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Filter size={14} className="text-zinc-500" />
                <span>Filter by Sender (/from:name)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => setValue("/subject:")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Filter size={14} className="text-zinc-500" />
                <span>Filter by Subject (/subject:text)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => setValue("/has:attachment")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Filter size={14} className="text-zinc-500" />
                <span>Filter by Attachment (/has:attachment)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => setValue("/is:unread")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Filter size={14} className="text-zinc-500" />
                <span>Filter by Unread (/is:unread)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => setValue("/is:pinned")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Filter size={14} className="text-zinc-500" />
                <span>Filter by Pinned (/is:pinned)</span>
              </Command.Item>
            </Command.Group>

            <div className="my-1 border-t border-zinc-800" />

            <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <Command.Item
                onSelect={() => { onAction("inbox"); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Inbox size={16} />
                <span>Go to Inbox</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onAction("calendar"); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Calendar size={16} />
                <span>Go to Calendar</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onAction("agent"); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Sparkles size={16} />
                <span>Open AI Agent (Cmd+I)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onAction("settings"); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Settings size={16} />
                <span>Go to Settings (g s)</span>
              </Command.Item>
            </Command.Group>
            
            <div className="my-1 border-t border-zinc-800" />
            
            <Command.Group heading="Actions" className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <Command.Item
                onSelect={() => { onAction("compose"); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <FileText size={16} />
                <span>Compose Email (c)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onAction("archive"); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Archive size={16} />
                <span>Archive Email (e)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onAction("mark-read"); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <Eye size={16} />
                <span>Toggle Read/Unread (u)</span>
              </Command.Item>
            </Command.Group>
            
            <div className="my-1 border-t border-zinc-800" />
            
            <Command.Group heading="Help" className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <Command.Item
                onSelect={() => { onAction("help"); setOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 rounded-md cursor-pointer hover:bg-zinc-800 hover:text-white"
              >
                <HelpCircle size={16} />
                <span>Keyboard Shortcuts List (?)</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
