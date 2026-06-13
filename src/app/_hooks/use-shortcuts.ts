import { useEffect, useRef } from "react";

type ShortcutHandler = (e: KeyboardEvent) => void;

type ShortcutMap = Record<string, ShortcutHandler>;

export function useShortcuts(shortcuts: ShortcutMap) {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape and Cmd+K inside inputs
        if (e.key === "Escape" && shortcuts.Escape) {
          shortcuts.Escape(e);
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "k" && shortcuts["Cmd+K"]) {
          shortcuts["Cmd+K"](e);
        }
        return;
      }

      const hasMeta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Handle Cmd+K
      if (hasMeta && key === "k") {
        const cmdKHandler = shortcuts["Cmd+K"];
        if (cmdKHandler) {
          cmdKHandler(e);
        }
        return;
      }

      // Check if this is part of a sequence
      if (lastKeyRef.current === "g") {
        const sequence = `g ${key}`;
        const seqHandler = shortcuts[sequence];
        if (seqHandler) {
          seqHandler(e);
          lastKeyRef.current = null;
          return;
        }
      }

      // Record key if it's 'g'
      if (key === "g") {
        lastKeyRef.current = "g";
        // Reset after a timeout in case they don't press a second key
        setTimeout(() => {
          if (lastKeyRef.current === "g") {
            lastKeyRef.current = null;
          }
        }, 1000);
        return;
      }

      // Trigger standard shortcut
      const keyHandler = shortcuts[e.key] ?? shortcuts[key];
      if (keyHandler) {
        keyHandler(e);
      }

      lastKeyRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
export type { ShortcutMap, ShortcutHandler };
