"use client";

import { Eye, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImpersonationBannerProps {
  email: string;
}

export function ImpersonationBanner({ email }: ImpersonationBannerProps) {
  const handleStopImpersonation = () => {
    // Delete the impersonation cookie by setting its expiry to past
    document.cookie = "gusion_impersonate_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    // Reload the page to reset the context
    window.location.reload();
  };

  return (
    <div className="bg-red-950/80 border-b border-red-500/30 text-white px-4 py-2 flex items-center justify-between gap-4 text-sm z-50 sticky top-0 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
        <Eye className="w-4 h-4 text-red-400 shrink-0" />
        <span className="font-medium tracking-tight">
          Impersonation Active: <span className="underline decoration-red-400">{email}</span>
        </span>
      </div>
      
      <Button
        onClick={handleStopImpersonation}
        size="sm"
        className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs px-3 py-1.5 h-8 flex items-center gap-1.5"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Exit</span>
      </Button>
    </div>
  );
}
