import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";

vi.mock("@/server/db", () => {
  return {
    conn: {},
    db: {
      query: {
        users: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        tickets: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        orgMembers: {
          findFirst: vi.fn(),
        },
        organizations: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(),
    },
  };
});

vi.mock("corsair", () => ({
  createCorsair: vi.fn().mockReturnValue({}),
  gmail: vi.fn(),
  googlecalendar: vi.fn(),
}));

vi.mock("@/server/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/server/auth";

describe("Support Tickets Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list tickets for the organization", async () => {
    // Mock user session & active org
    (vi.mocked(auth) as any).mockResolvedValue({
      user: { id: "user_1" },
    });

    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      activeOrgId: "org_1",
    } as any);

    vi.mocked(db.query.orgMembers.findFirst).mockResolvedValue({
      userId: "user_1",
      orgId: "org_1",
      role: "owner",
    } as any);

    vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
      id: "org_1",
      name: "Acme Corp",
    } as any);

    // Mock tickets
    vi.mocked(db.query.tickets.findMany).mockResolvedValue([
      {
        id: "t_1",
        orgId: "org_1",
        publicId: "GSN-1001",
        subject: "Help with account",
        status: "open",
        assignedUserId: null,
      },
    ] as any);

    const ctx = await createTRPCContext({ headers: new Headers() });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tickets.listTickets();
    expect(result.length).toBe(1);
    expect(result[0]?.publicId).toBe("GSN-1001");
    expect(result[0]?.assignedUser).toBeNull();
  });

  it("should update ticket status", async () => {
    (vi.mocked(auth) as any).mockResolvedValue({
      user: { id: "user_1" },
    });

    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      activeOrgId: "org_1",
    } as any);

    vi.mocked(db.query.orgMembers.findFirst).mockResolvedValue({
      userId: "user_1",
      orgId: "org_1",
      role: "owner",
    } as any);

    vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
      id: "org_1",
      name: "Acme Corp",
    } as any);

    // Mock ticket details
    vi.mocked(db.query.tickets.findFirst).mockResolvedValue({
      id: "t_1",
      orgId: "org_1",
      status: "open",
    } as any);

    // Mock update status returning chain
    const mockReturning = vi.fn().mockResolvedValue([{ id: "t_1", status: "resolved" }]);
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        returning: mockReturning,
      }),
    } as any);

    const ctx = await createTRPCContext({ headers: new Headers() });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tickets.updateTicketStatus({
      id: "t_1",
      status: "resolved",
    });

    expect(result?.status).toBe("resolved");
  });
});
