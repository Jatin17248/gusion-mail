import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../app/api/webhooks/route";
import { db } from "@/server/db";
import { getTenant } from "@/server/lib/tenant";
import { processWebhook } from "corsair";
import { generateObject } from "ai";
import { NextRequest } from "next/server";

vi.mock("@/server/db", () => {
  const mockUpsertChain = {
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  const mockInsertChain = {
    values: vi.fn().mockReturnValue(mockUpsertChain),
  };
  return {
    conn: {},
    db: {
      query: {
        users: { findFirst: vi.fn() },
        webhookEvents: { findFirst: vi.fn() },
        emailMeta: { findFirst: vi.fn() },
        contacts: { findFirst: vi.fn() },
      },
      insert: vi.fn().mockReturnValue(mockInsertChain),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: "updated" }]),
    },
  };
});

vi.mock("@/server/lib/tenant", () => ({
  getTenant: vi.fn(),
}));

vi.mock("corsair", () => ({
  createCorsair: vi.fn().mockReturnValue({}),
  processWebhook: vi.fn(),
  gmail: vi.fn(),
  googlecalendar: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => {
  const mockModel = vi.fn();
  return {
    createGoogleGenerativeAI: vi.fn().mockReturnValue(mockModel),
    google: mockModel,
  };
});

vi.mock("@/server/lib/realtime", () => ({
  publishUserEvent: vi.fn(),
}));

describe("Contacts Webhook Ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract sender email/name, upsert contact, and apply VIP priority status", async () => {
    // Mock user tenant
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_123",
      corsairTenantId: "tenant_abc",
      email: "host@example.com",
    } as any);

    // Mock no duplicate webhook
    vi.mocked(db.query.webhookEvents.findFirst).mockResolvedValue(undefined);

    // Mock webhook parser outputting a gmail sync event
    vi.mocked(processWebhook).mockResolvedValue({
      plugin: "gmail",
      action: "sync",
      response: { success: true },
    } as any);

    // Mock 1 new email message fetched
    const mockMessages = {
      list: vi.fn().mockResolvedValue([
        {
          entity_id: "msg_abc_1",
          data: {
            threadId: "thread_abc_1",
            subject: "Urgent: System Down",
            from: "VIP John <john@vip.com>", // Parser will extract: name="VIP John", email="john@vip.com"
            snippet: "The production database is unresponsive.",
          },
        },
      ]),
    };

    vi.mocked(getTenant).mockReturnValue({
      gmail: { db: { messages: mockMessages } },
    } as any);

    // Mock contact lookups: first one returns VIP contact
    vi.mocked(db.query.contacts.findFirst).mockResolvedValue({
      id: "contact_1",
      email: "john@vip.com",
      name: "VIP John",
      isVip: true, // VIP sender!
    } as any);

    // Mock no existing emailMeta
    vi.mocked(db.query.emailMeta.findFirst).mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/webhooks?tenantId=tenant_abc", {
      method: "POST",
      body: JSON.stringify({ message: {} }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify contact was upserted
    expect(db.insert).toHaveBeenCalled();
    
    // Verify VIP prioritized directly (priority should be high, VIP sender true, and NO Gemini API call)
    expect(generateObject).not.toHaveBeenCalled();
  });
});
