"use client";

import { Wrench } from "lucide-react";

export function MaintenanceView() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#09090B] text-white p-4">
      <div className="max-w-md w-full border border-amber-500/20 bg-[#121214] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 animate-pulse">
            <Wrench className="w-8 h-8 text-amber-500" />
          </div>
          
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            System Maintenance
          </h1>
          
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Gusion Mail is currently performing planned maintenance to upgrade system infrastructure. We will be back online shortly.
          </p>

          <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Updates in progress...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
