import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../app/api/agent/chat/route";
import { auth } from "@/server/auth";
import { getTenant } from "@/server/lib/tenant";
import { streamText } from "ai";

vi.mock("@/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/lib/tenant", () => ({
  getTenant: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("ai")>();
  return {
    ...original,
    streamText: vi.fn().mockImplementation((config: any) => {
      return {
        toUIMessageStreamResponse: () => new Response("mock-stream"),
        _config: config,
      };
    }),
  };
});

describe("Agent Tools API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if unauthorized", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    const request = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should setup streamText with correct tools and execute them", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user_123", corsairTenantId: "tenant_abc" },
    } as any);

    const mockMessages = {
      search: vi.fn().mockResolvedValue([]),
      findByEntityId: vi.fn().mockResolvedValue(null),
    };
    const mockEvents = {
      list: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(getTenant).mockReturnValue({
      gmail: { db: { messages: mockMessages } },
      googlecalendar: { db: { events: mockEvents } },
    } as any);

    const request = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const streamTextMock = vi.mocked(streamText);
    const config = (streamTextMock.mock.results[0]?.value as any)._config;
    
    expect(config.tools.proposeEmail).toBeDefined();
    expect(config.tools.proposeCalendarEvent).toBeDefined();

    // Test execute proposeEmail
    const proposeEmailResult = await config.tools.proposeEmail.execute({
      to: "test@example.com",
      subject: "Hello",
      body: "Test body",
    });
    expect(proposeEmailResult.status).toBe("requires_confirmation");
    expect(proposeEmailResult.proposalType).toBe("email");

    // Test execute proposeCalendarEvent
    const proposeEventResult = await config.tools.proposeCalendarEvent.execute({
      summary: "Sync Meeting",
      start: "2026-06-13T10:00:00Z",
      end: "2026-06-13T10:30:00Z",
    });
    expect(proposeEventResult.status).toBe("requires_confirmation");
    expect(proposeEventResult.proposalType).toBe("event");
  });
});
