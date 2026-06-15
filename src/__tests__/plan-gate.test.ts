import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasActivePlanOrTrial } from "../server/lib/plan-gate";
import { db } from "@/server/db";

// Mock the db module
vi.mock("@/server/db", () => {
  return {
    db: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
        subscriptions: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

describe("hasActivePlanOrTrial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false if user is not found", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

    const result = await hasActivePlanOrTrial("user_not_found");
    expect(result).toBe(false);
  });

  it("should return true if user is in their 14-day trial period", async () => {
    const trialStartedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      trialStartedAt,
    } as any);

    const result = await hasActivePlanOrTrial("user_1");
    expect(result).toBe(true);
  });

  it("should check subscription if trial period is expired (e.g. 15 days ago)", async () => {
    const trialStartedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      trialStartedAt,
    } as any);

    // Mock active subscription
    vi.mocked(db.query.subscriptions.findFirst).mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      status: "active",
    } as any);

    const result = await hasActivePlanOrTrial("user_1");
    expect(result).toBe(true);
  });

  it("should return false if trial is expired and there is no active subscription", async () => {
    const trialStartedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      trialStartedAt,
    } as any);

    // Mock inactive/canceled subscription
    vi.mocked(db.query.subscriptions.findFirst).mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      status: "canceled",
    } as any);

    const result = await hasActivePlanOrTrial("user_1");
    expect(result).toBe(false);
  });

  it("should return false if trial is expired and no subscription entry exists", async () => {
    const trialStartedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      trialStartedAt,
    } as any);

    vi.mocked(db.query.subscriptions.findFirst).mockResolvedValue(undefined);

    const result = await hasActivePlanOrTrial("user_1");
    expect(result).toBe(false);
  });

  it("should return true if trial is expired but subscription is trialing", async () => {
    const trialStartedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      trialStartedAt,
    } as any);

    vi.mocked(db.query.subscriptions.findFirst).mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      status: "trialing",
    } as any);

    const result = await hasActivePlanOrTrial("user_1");
    expect(result).toBe(true);
  });
});
