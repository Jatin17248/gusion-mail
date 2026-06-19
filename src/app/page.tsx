"use client";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useEffect } from "react";

const NewLanding = dynamic(() =>
  import("@/app/_components/new-landing").then((m) => ({ default: m.NewLanding }))
);
const Onboarding = dynamic(() =>
  import("@/app/_components/onboarding").then((m) => ({ default: m.Onboarding }))
);
const Dashboard = dynamic(() =>
  import("@/app/_components/dashboard").then((m) => ({ default: m.Dashboard }))
);

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
      <div className="flex items-center justify-center min-h-screen bg-[#FAFAF9]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <NewLanding />;
  }

  if (!session.user.gmailConnected || !session.user.calendarConnected) {
    return <Onboarding />;
  }

  return <Dashboard />;
}
