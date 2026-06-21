"use client";
import { createContext, useContext } from "react";

interface DashboardContextValue {
  setComposeOpen: (open: boolean) => void;
  agentOpen: boolean;
  setAgentOpen: (open: boolean) => void;
  openUpgrade: (reason?: string) => void;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardShell");
  return ctx;
}
