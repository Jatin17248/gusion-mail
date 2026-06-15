import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../app/api/webhooks/route";
import { db } from "@/server/db";
import { processWebhook } from "corsair";
import { generateObject } from "ai";
import { getTenant } from "@/server/lib/tenant";
import { NextRequest } from "next/server";

vi.mock("corsair", () => ({
  createCorsair: vi.fn().mockReturnValue({}),
  processWebhook: vi.fn(),
  gmail: vi.fn(),
  googlecalendar: vi.fn(),
}));

vi.mock("@/server/db", () => {
  const mockValues = () => {
    const p = Promise.resolve(undefined) as any;
    p.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    return p;
  };
  return {
    conn: {},
    db: {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation(mockValues),
      }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
      query: {
        users: {
          findFirst: vi.fn(),
        },
        webhookEvents: {
          findFirst: vi.fn(),
        },
        emailMeta: {
          findFirst: vi.fn(),
        },
        contacts: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

vi.mock("@/server/lib/tenant", () => ({
  getTenant: vi.fn(),
}));

vi.mock("@/env", () => ({
  env: {
    GEMINI_API_KEY: "mock-key",
  },
}));

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      priority: "high",
      reason: "Mocked",
      category: "important",
    },
  }),
  google: vi.fn(),
}));

describe("Webhook Processing & Idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 if the tenant does not map to a user", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/webhooks?tenantId=unknown_tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("should return 200 with duplicate=true if webhook is already processed", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_123",
      corsairTenantId: "dev",
    } as any);

    vi.mocked(db.query.webhookEvents.findFirst).mockResolvedValue({
      id: "evt_duplicate",
      status: "processed",
    } as any);

    const request = new NextRequest("http://localhost/api/webhooks?tenantId=dev", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-corsair-event-id": "evt_duplicate",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.duplicate).toBe(true);
  });

  it("should process new webhook, call priority classification, and save details", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_123",
      corsairTenantId: "dev",
    } as any);

    vi.mocked(db.query.webhookEvents.findFirst).mockResolvedValue(undefined);

    vi.mocked(processWebhook).mockResolvedValue({
      plugin: "gmail",
      action: "message_received",
      responseHeaders: {},
      response: { success: true },
    } as any);

    const mockMessages = [
      {
        entity_id: "msg_999",
        data: {
          from: "sender@example.com",
          subject: "Urgent issue",
          snippet: "Please look at this immediately",
        },
      },
    ];

    vi.mocked(getTenant).mockReturnValue({
      gmail: {
        db: {
          messages: {
            list: vi.fn().mockResolvedValue(mockMessages),
          },
        },
      },
    } as any);

    const request = new NextRequest("http://localhost/api/webhooks?tenantId=dev", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-corsair-event-id": "evt_new_123",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);

    // Verify generateObject was called for classification
    expect(generateObject).toHaveBeenCalled();
  });
});
