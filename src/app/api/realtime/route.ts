import type { NextRequest } from "next/server";
import { auth } from "@/server/auth";
import { getLatestUserEvent } from "@/server/lib/realtime";

export const dynamic = "force-dynamic";
// Long-lived SSE connection; the browser's EventSource auto-reconnects when the
// serverless function reaches this limit, so updates keep flowing.
export const maxDuration = 60;

const POLL_MS = 4000;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: connected\n\n"));

      // Only forward events that occur after the connection opens.
      let lastTs = Date.now();
      let closed = false;

      const tick = async () => {
        try {
          const event = await getLatestUserEvent(userId);
          if (event && event.ts > lastTs) {
            lastTs = event.ts;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } else {
            controller.enqueue(encoder.encode("data: ping\n\n"));
          }
        } catch {
          // Ignore transient Redis errors; the next tick retries.
        }
      };

      const interval = setInterval(() => void tick(), POLL_MS);

      request.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
