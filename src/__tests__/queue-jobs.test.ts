/* eslint-disable */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../app/api/jobs/process/route";
import { db } from "@/server/db";
import { getTenant } from "@/server/lib/tenant";
import { appEventEmitter } from "@/server/lib/event-emitter";

vi.mock("@/server/db", () => {
  const mockUpdateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: "mock-id" }]),
  };
  return {
    db: {
      query: {
        emailMeta: { findMany: vi.fn() },
        sendQueue: { findMany: vi.fn() },
        followUps: { findMany: vi.fn() },
        users: { findFirst: vi.fn() },
      },
      update: vi.fn().mockReturnValue(mockUpdateChain),
    },
  };
});

vi.mock("@/server/lib/tenant", () => ({
  getTenant: vi.fn(),
}));

vi.mock("@/server/lib/event-emitter", () => ({
  appEventEmitter: {
    emit: vi.fn(),
  },
}));

describe("Queue Background Worker (/api/jobs/process)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process snooze releases and emit realtime update", async () => {
    // Mock 1 snoozed mail ready to release
    vi.mocked(db.query.emailMeta.findMany).mockResolvedValue([
      {
        id: "meta_1",
        userId: "user_1",
        gmailMessageId: "msg_1",
        isSnoozed: true,
        snoozeUntil: new Date(Date.now() - 1000),
      },
    ] as any);

    // Mock empty queues for others to isolate test
    vi.mocked(db.query.sendQueue.findMany).mockResolvedValue([]);
    vi.mocked(db.query.followUps.findMany).mockResolvedValue([]);

    const res = await POST();
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.results.snoozedReleased).toBe(1);
    expect(db.update).toHaveBeenCalled();
    expect(appEventEmitter.emit).toHaveBeenCalledWith("update:user_1", {
      type: "inbox_update",
      message: "Snoozed email released to inbox",
    });
  });

  it("should dispatch pending send later scheduled emails", async () => {
    vi.mocked(db.query.emailMeta.findMany).mockResolvedValue([]);
    
    // Mock 1 send later email ready
    vi.mocked(db.query.sendQueue.findMany).mockResolvedValue([
      {
        id: "send_1",
        userId: "user_1",
        rawBase64Url: "bW9jay1lbWFpbC1kYXRh",
        threadId: "thread_1",
        sendAt: new Date(Date.now() - 1000),
        status: "pending",
      },
    ] as any);

    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      corsairTenantId: "tenant_1",
    } as any);

    vi.mocked(db.query.followUps.findMany).mockResolvedValue([]);

    const mockSend = vi.fn().mockResolvedValue({ id: "sent_msg_123" });
    vi.mocked(getTenant).mockReturnValue({
      gmail: { api: { messages: { send: mockSend } } },
    } as any);

    const res = await POST();
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.results.emailsSent).toBe(1);
    expect(mockSend).toHaveBeenCalledWith({
      raw: "bW9jay1lbWFpbC1kYXRh",
      threadId: "thread_1",
    });
  });

  it("should remind follow-up if no reply was received from other sender", async () => {
    vi.mocked(db.query.emailMeta.findMany).mockResolvedValue([]);
    vi.mocked(db.query.sendQueue.findMany).mockResolvedValue([]);

    // Mock 1 pending follow-up
    vi.mocked(db.query.followUps.findMany).mockResolvedValue([
      {
        id: "follow_1",
        userId: "user_1",
        threadId: "thread_99",
        sentMessageId: "msg_sent_99",
        remindAt: new Date(Date.now() - 1000),
        reason: "Expect response",
        status: "pending",
      },
    ] as any);

    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      email: "host@example.com",
      corsairTenantId: "tenant_1",
    } as any);

    const mockSearch = vi.fn().mockResolvedValue([
      {
        entity_id: "msg_sent_99",
        data: {
          from: "host@example.com",
          createdAt: new Date(Date.now() - 2000),
        },
      },
      // Note: No messages after this from anyone else
    ]);

    vi.mocked(getTenant).mockReturnValue({
      gmail: { db: { messages: { search: mockSearch } } },
    } as any);

    const res = await POST();
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.results.followUpsReminded).toBe(1);
    expect(appEventEmitter.emit).toHaveBeenCalledWith("update:user_1", {
      type: "inbox_update",
      message: "Follow-up Reminder: No response to thread. Reason: Expect response",
    });
  });

  it("should dismiss follow-up if a reply was received from other sender", async () => {
    vi.mocked(db.query.emailMeta.findMany).mockResolvedValue([]);
    vi.mocked(db.query.sendQueue.findMany).mockResolvedValue([]);

    // Mock 1 pending follow-up
    vi.mocked(db.query.followUps.findMany).mockResolvedValue([
      {
        id: "follow_1",
        userId: "user_1",
        threadId: "thread_99",
        sentMessageId: "msg_sent_99",
        remindAt: new Date(Date.now() - 1000),
        reason: "Expect response",
        status: "pending",
      },
    ] as any);

    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      email: "host@example.com",
      corsairTenantId: "tenant_1",
    } as any);

    const mockSearch = vi.fn().mockResolvedValue([
      {
        entity_id: "msg_sent_99",
        data: {
          from: "host@example.com",
          createdAt: new Date(Date.now() - 5000),
        },
      },
      {
        entity_id: "msg_reply_99",
        data: {
          from: "someone-else@example.com", // This is the reply!
          createdAt: new Date(Date.now() - 2000),
        },
      },
    ]);

    vi.mocked(getTenant).mockReturnValue({
      gmail: { db: { messages: { search: mockSearch } } },
    } as any);

    const res = await POST();
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.results.followUpsDismissed).toBe(1);
    expect(appEventEmitter.emit).not.toHaveBeenCalledWith("update:user_1", expect.objectContaining({
      message: expect.stringContaining("Follow-up Reminder"),
    }));
  });
});
