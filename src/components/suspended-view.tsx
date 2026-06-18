"use client";

import { signOut } from "next-auth/react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuspendedView() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#09090B] text-white p-4">
      <div className="max-w-md w-full border border-red-500/20 bg-[#121214] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            Access Suspended
          </h1>
          
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Your Gusion Mail account has been suspended by the platform administrator due to an abuse report, billing failure, or terms of service violation. If you believe this is a mistake, please contact support.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={() => {
                window.location.href = "mailto:support@gusion.in?subject=Gusion Mail Suspension Appeal";
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium h-11 w-full"
            >
              Contact Support
            </Button>
            
            <Button
              onClick={() => signOut({ callbackUrl: "/login" })}
              variant="ghost"
              className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 h-11 w-full"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
