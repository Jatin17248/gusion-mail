import React, { useEffect } from "react";
import { Command } from "cmdk";
import { Inbox, Calendar, FileText, HelpCircle, Archive, Eye } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAction: (action: string) => void;
}

export function CommandPalette({ open, setOpen, onAction }: CommandPaletteProps) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-zinc-950/60 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-md">
        <Command label="Global Command Menu" className="w-full">
          <div className="flex items-center border-b border-zinc-800 px-3">
            <Command.Input
              placeholder="Search commands (e.g. 'compose', 'calendar')..."
              className="flex h-12 w-full bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-zinc-500">
              No results found.
            </Command.Empty>
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
