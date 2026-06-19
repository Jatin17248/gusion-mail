import { useEffect } from "react";

type ShortcutHandler = (e: KeyboardEvent) => void;

type ShortcutMap = Record<string, ShortcutHandler>;

function matchShortcut(declaration: string, e: KeyboardEvent): boolean {
  const parts = declaration.split("+");
  const mainKey = parts[parts.length - 1];
  if (!mainKey) return false;

  const requiresCmdOrCtrl = parts.some(
    (p) => p.toLowerCase() === "cmd" || p.toLowerCase() === "ctrl"
  );
  const requiresShift = parts.some((p) => p.toLowerCase() === "shift");
  const requiresAlt = parts.some((p) => p.toLowerCase() === "alt");

  // Check modifier keys
  const hasCmdOrCtrl = e.metaKey || e.ctrlKey;
  const hasShift = e.shiftKey;
  const hasAlt = e.altKey;

  if (requiresCmdOrCtrl !== hasCmdOrCtrl) return false;
  if (requiresShift !== hasShift) return false;
  if (requiresAlt !== hasAlt) return false;

  // Check key (case-insensitive)
  return mainKey.toLowerCase() === e.key.toLowerCase();
}

export function useShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Find if there is any matching shortcut in our map
      const matchedKey = Object.keys(shortcuts).find((k) =>
        matchShortcut(k, e)
      );

      if (!matchedKey) {
        // If we have modifier keys pressed (Cmd or Ctrl), and it wasn't matched,
        // we block any further fallback processing to protect default browser keys.
        const hasMeta = e.metaKey || e.ctrlKey;
        if (hasMeta) {
          return;
        }
        return;
      }

      const handler = shortcuts[matchedKey];
      if (!handler) return;

      // 1. If in input/textarea, only allow Escape and shortcuts with Cmd/Ctrl modifiers
      if (isInput) {
        const parts = matchedKey.toLowerCase().split("+");
        const hasCmdOrCtrl = parts.includes("cmd") || parts.includes("ctrl");
        const isEscape = parts.includes("escape");

        if (hasCmdOrCtrl || isEscape) {
          handler(e);
        }
        return;
      }

      // 2. Otherwise run the handler normally
      handler(e);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
export type { ShortcutMap, ShortcutHandler };
