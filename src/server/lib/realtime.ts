import { redis } from "@/server/lib/redis";

export interface UserEvent {
  type: "inbox_update" | "calendar_update";
  message: string;
}

export interface StoredUserEvent extends UserEvent {
  ts: number;
}

/**
 * Publish a per-user realtime event.
 *
 * Backed by Redis so it works across serverless instances in production (the
 * webhook and the SSE connection run on different invocations). In local dev
 * `redis` falls back to an in-process Map, which still works within one
 * instance. The SSE endpoint (`/api/realtime`) polls the user's latest event
 * and forwards new ones to the browser.
 */
export async function publishUserEvent(
  userId: string,
  event: UserEvent,
): Promise<void> {
  const payload: StoredUserEvent = { ...event, ts: Date.now() };
  await redis.set(`realtime:${userId}`, payload, { ex: 120 });
}

export async function getLatestUserEvent(
  userId: string,
): Promise<StoredUserEvent | null> {
  return (await redis.get(`realtime:${userId}`)) as StoredUserEvent | null;
}
