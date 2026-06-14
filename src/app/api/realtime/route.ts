import type { NextRequest } from "next/server";
import { auth } from "@/server/auth";
import { appEventEmitter } from "@/server/lib/event-emitter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection successful event
      controller.enqueue(encoder.encode("data: connected\n\n"));

      const onUpdate = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const eventName = `update:${userId}`;
      appEventEmitter.on(eventName, onUpdate);

      // Periodic keep-alive ping
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode("data: ping\n\n"));
        } catch {
          // Stream might be closed
          clearInterval(pingInterval);
        }
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        appEventEmitter.off(eventName, onUpdate);
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
      "Connection": "keep-alive",
    },
  });
}
