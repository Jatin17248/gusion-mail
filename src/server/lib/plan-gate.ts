import { db } from "@/server/db";
import { users, subscriptions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function hasActivePlanOrTrial(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) return false;

  // 14-day trial check
  if (user.trialStartedAt) {
    const elapsed = Date.now() - new Date(user.trialStartedAt).getTime();
    const elapsedDays = elapsed / (1000 * 60 * 60 * 24);
    if (elapsedDays < 14) {
      return true;
    }
  }

  // Active subscription check
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (sub && (sub.status === "active" || sub.status === "trialing")) {
    return true;
  }

  return false;
}
