import { NextResponse } from "next/server";
import { processLifecycle } from "@/server/lib/worker-tasks";

export const maxDuration = 60; // 60 seconds

export async function GET(request: Request) {
  // Simple auth check for cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const results = await processLifecycle();
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Cron failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
