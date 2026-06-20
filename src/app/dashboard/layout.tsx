import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardShell } from "@/app/dashboard/_components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.gmailConnected || !session.user.calendarConnected) {
    redirect("/onboarding");
  }

  return (
    <Suspense>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
