import { corsair } from "@/server/corsair";

/**
 * Resolve a Corsair tenant for a user. Throws when no tenant id is present so
 * we never silently fall back to a shared "dev" tenant — that would cross user
 * data boundaries. Every authenticated user is assigned a `corsairTenantId` on
 * sign-up, so a missing value means the caller has no business reading mail.
 */
export function getTenant(corsairTenantId?: string | null) {
  if (!corsairTenantId) {
    throw new Error(
      "No Corsair tenant for this user. Connect a Google account before accessing mail or calendar.",
    );
  }
  return corsair.withTenant(corsairTenantId);
}
