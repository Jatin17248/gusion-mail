import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Onboarding } from "@/app/_components/onboarding";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.gmailConnected && session.user.calendarConnected) {
    redirect("/dashboard");
  }

  return <Onboarding />;
}
