import { db } from "@/server/db";
import { apiKeys } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function validateApiKey(
  apiKeyHeader: string | null
): Promise<{ orgId: string; scopes: string[] } | null> {
  if (!apiKeyHeader) {
    return null;
  }

  // Support both "Bearer <key>" and plain "<key>" formats for convenience
  const token = apiKeyHeader.startsWith("Bearer ")
    ? apiKeyHeader.substring(7).trim()
    : apiKeyHeader.trim();

  const hashed = crypto.createHash("sha256").update(token).digest("hex");

  const keyRecord = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.hashedKey, hashed),
  });

  if (!keyRecord || !keyRecord.isActive) {
    return null;
  }

  let scopes: string[] = [];
  try {
    scopes = JSON.parse(keyRecord.scopes);
  } catch (e) {
    scopes = [];
  }

  return {
    orgId: keyRecord.orgId,
    scopes,
  };
}
