"use client";

import { useSession } from "next-auth/react";
import { Landing } from "@/app/_components/landing";
import { Onboarding } from "@/app/_components/onboarding";
import { Dashboard } from "@/app/_components/dashboard";

import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get("ref");
      if (refCode) {
        localStorage.setItem("gusion_referral_code", refCode.toUpperCase());
      }
    }
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Landing />;
  }

  if (!session.user.gmailConnected || !session.user.calendarConnected) {
    return <Onboarding />;
  }

  return <Dashboard />;
}
