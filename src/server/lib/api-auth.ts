import { db } from "@/server/db";
import { apiKeys } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export interface ApiKeyAuth {
  orgId: string;
  scopes: string[];
}

/**
 * Validate an inbound API key (accepts `Bearer <key>` or a raw key) and return
 * the owning org + granted scopes, or null when the key is missing/invalid.
 */
export async function validateApiKey(
  apiKeyHeader: string | null,
): Promise<ApiKeyAuth | null> {
  if (!apiKeyHeader) return null;

  const token = apiKeyHeader.startsWith("Bearer ")
    ? apiKeyHeader.substring(7).trim()
    : apiKeyHeader.trim();

  const hashed = crypto.createHash("sha256").update(token).digest("hex");

  const keyRecord = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.hashedKey, hashed),
  });

  if (!keyRecord?.isActive) return null;

  let scopes: string[] = [];
  try {
    const parsed: unknown = JSON.parse(keyRecord.scopes);
    if (Array.isArray(parsed)) {
      scopes = parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    scopes = [];
  }

  return { orgId: keyRecord.orgId, scopes };
}

/** True when the key's scopes permit `required` (wildcard `*` or empty = allow). */
export function hasScope(scopes: string[], required: string): boolean {
  if (scopes.length === 0) return true;
  return scopes.includes(required) || scopes.includes("*");
}
