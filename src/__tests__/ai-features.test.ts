vi.mock("@/env", () => ({
  env: {
    DATABASE_URL: "postgres://localhost/test",
    AUTH_SECRET: "secret",
    AUTH_GOOGLE_ID: "google-id",
    AUTH_GOOGLE_SECRET: "google-secret",
    CORSAIR_KEK: "kek",
    GEMINI_API_KEY: "mock-key",
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { db } from "@/server/db";
import { hasActivePlanOrTrial } from "@/server/lib/plan-gate";
import { getTenant } from "@/server/lib/tenant";
import { generateText, generateObject } from "ai";

vi.mock("@/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    query: {
      emailMeta: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock("@/server/lib/plan-gate", () => ({
  hasActivePlanOrTrial: vi.fn(),
}));

vi.mock("@/server/lib/tenant", () => ({
  getTenant: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(),
}));

describe("AI Features Router", () => {
  const mockCtx = {
    session: {
      user: {
        id: "user_123",
        corsairTenantId: "tenant_abc",
        email: "host@example.com",
      },
    },
    db: db as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw UNAUTHORIZED if the user does not have an active plan or trial", async () => {
    vi.mocked(hasActivePlanOrTrial).mockResolvedValue(false);

    const caller = appRouter.createCaller(mockCtx as any);

    await expect(
      caller.ai.aiCompose({ prompt: "Hello world" })
    ).rejects.toThrow("This feature requires a premium plan or an active 14-day trial.");
  });

  it("should generate email draft using aiCompose", async () => {
    vi.mocked(hasActivePlanOrTrial).mockResolvedValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: "Draft email content",
    } as any);

    const caller = appRouter.createCaller(mockCtx as any);
    const result = await caller.ai.aiCompose({
      prompt: "Compose professional check-in",
      tone: "professional",
      styleContext: "formal",
    });

    expect(result.text).toBe("Draft email content");
    expect(generateText).toHaveBeenCalled();
  });

  it("should generate 3 smart replies using aiSmartReply", async () => {
    vi.mocked(hasActivePlanOrTrial).mockResolvedValue(true);
    
    const mockMessages = {
      findByEntityId: vi.fn().mockResolvedValue({
        entity_id: "msg_123",
        data: {
          subject: "Project Update",
          from: "sender@example.com",
          body: "Are we still on for today?",
        },
      }),
    };

    vi.mocked(getTenant).mockReturnValue({
      gmail: { db: { messages: mockMessages } },
    } as any);

    const mockObjectResult = {
      replies: [
        { label: "Yes, I'm ready", body: "Yes, we are still on." },
        { label: "No, reschedule", body: "No, let's reschedule." },
        { label: "Running late", body: "I am running late." },
      ],
    };

    vi.mocked(generateObject).mockResolvedValue({
      object: mockObjectResult,
    } as any);

    const caller = appRouter.createCaller(mockCtx as any);
    const result = await caller.ai.aiSmartReply({ messageId: "msg_123" });

    expect(result.replies).toHaveLength(3);
    expect(result.replies[0]?.label).toBe("Yes, I'm ready");
  });

  it("should summarize email thread using aiSummarize", async () => {
    vi.mocked(hasActivePlanOrTrial).mockResolvedValue(true);

    const mockMessages = {
      search: vi.fn().mockResolvedValue([
        {
          entity_id: "msg_1",
          data: {
            from: "sender@example.com",
            body: "Hi, let's schedule a kickoff meeting.",
            createdAt: new Date("2026-06-14T09:00:00Z"),
          },
        },
        {
          entity_id: "msg_2",
          data: {
            from: "host@example.com",
            body: "Sure, how about Monday morning?",
            createdAt: new Date("2026-06-14T09:30:00Z"),
          },
        },
      ]),
    };

    vi.mocked(getTenant).mockReturnValue({
      gmail: { db: { messages: mockMessages } },
    } as any);

    vi.mocked(generateText).mockResolvedValue({
      text: "Kickoff meeting scheduled for Monday morning.",
    } as any);

    const caller = appRouter.createCaller(mockCtx as any);
    const result = await caller.ai.aiSummarize({ threadId: "thread_123" });

    expect(result.summary).toBe("Kickoff meeting scheduled for Monday morning.");
  });

  it("should generate daily brief when high-priority emails exist", async () => {
    vi.mocked(hasActivePlanOrTrial).mockResolvedValue(true);

    // Mock high priority meta records
    vi.mocked(db.query.emailMeta.findMany).mockResolvedValue([
      {
        gmailMessageId: "msg_high_1",
        priority: "high",
        createdAt: new Date(),
      },
    ] as any);

    const mockMessages = {
      findManyByEntityIds: vi.fn().mockResolvedValue([
        {
          entity_id: "msg_high_1",
          data: {
            subject: "Urgent Server Issue",
            from: "ops@company.com",
            snippet: "The server is down. Action required.",
          },
        },
      ]),
    };

    vi.mocked(getTenant).mockReturnValue({
      gmail: { db: { messages: mockMessages } },
    } as any);

    vi.mocked(generateText).mockResolvedValue({
      text: "Briefing summary content",
    } as any);

    const caller = appRouter.createCaller(mockCtx as any);
    const result = await caller.ai.aiDailyBrief();

    expect(result.brief).toBe("Briefing summary content");
  });
});
