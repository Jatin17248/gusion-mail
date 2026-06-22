import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { refreshGoogleAccessToken } from "@/server/lib/google-token";

vi.mock("@/env", () => ({
  env: {
    AUTH_GOOGLE_ID: "client-id",
    AUTH_GOOGLE_SECRET: "client-secret",
  },
}));

describe("refreshGoogleAccessToken", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts a refresh_token grant to Google and returns a fresh token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "new-access-token",
        expires_in: 3599,
        token_type: "Bearer",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshGoogleAccessToken("the-refresh-token");

    // expires_at = now (in seconds) + expires_in.
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(result).toEqual({
      accessToken: "new-access-token",
      expiresAt: nowSeconds + 3599,
      refreshToken: undefined,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("client_id=client-id");
    expect(body).toContain("client_secret=client-secret");
    expect(body).toContain("refresh_token=the-refresh-token");
  });

  it("falls back to a 1h lifetime when expires_in is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok" }),
      }),
    );

    const result = await refreshGoogleAccessToken("rt");
    expect(result.expiresAt).toBe(Math.floor(Date.now() / 1000) + 3600);
  });

  it("preserves a rotated refresh_token when Google returns one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "tok",
          expires_in: 3600,
          refresh_token: "rotated-rt",
        }),
      }),
    );

    const result = await refreshGoogleAccessToken("rt");
    expect(result.refreshToken).toBe("rotated-rt");
  });

  it("throws on an OAuth error response (so callers can flag a reconnect)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "invalid_grant",
          error_description: "Token has been expired or revoked.",
        }),
      }),
    );

    await expect(refreshGoogleAccessToken("rt")).rejects.toThrow(
      /Token has been expired or revoked/,
    );
  });

  it("throws when the body lacks an access_token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      }),
    );

    await expect(refreshGoogleAccessToken("rt")).rejects.toThrow(
      /Google token refresh failed/,
    );
  });
});
