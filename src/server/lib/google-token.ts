import { env } from "@/env";

export interface RefreshedGoogleToken {
  accessToken: string;
  /** Unix timestamp in **seconds** at which the new access token expires. */
  expiresAt: number;
  /**
   * Google only returns a new refresh_token on the first consent, so this is
   * usually undefined on a refresh — callers must keep the existing one.
   */
  refreshToken?: string;
}

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Default Google access-token lifetime if the response omits expires_in.
const DEFAULT_EXPIRES_IN_SECONDS = 3600;

/**
 * Exchange a Google `refresh_token` for a fresh access token via the OAuth 2.0
 * token endpoint. Throws on a non-2xx response or a malformed body so callers
 * can flag the session for reconnect rather than persisting a stale token.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<RefreshedGoogleToken> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.AUTH_GOOGLE_ID,
      client_secret: env.AUTH_GOOGLE_SECRET,
      refresh_token: refreshToken,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!res.ok || !data?.access_token) {
    const reason =
      data?.error_description ?? data?.error ?? `HTTP ${res.status}`;
    throw new Error(`Google token refresh failed: ${reason}`);
  }

  return {
    accessToken: data.access_token,
    expiresAt:
      Math.floor(Date.now() / 1000) +
      (data.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS),
    refreshToken: data.refresh_token,
  };
}
