"use client";

import { useRouter } from "next/navigation";
import { TicketsView } from "@/app/_components/dashboard/support-queue";

export default function TicketsPage() {
  const router = useRouter();
  return (
    <TicketsView
      onOpenMessage={(msgId) => router.push(`/dashboard/inbox?msg=${msgId}`)}
    />
  );
}
