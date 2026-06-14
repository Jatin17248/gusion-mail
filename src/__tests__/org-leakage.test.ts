import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";

vi.mock("@/server/db", () => {
  return {
    conn: {},
    db: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
        orgMembers: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        organizations: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
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

describe("Organization Context and Role Gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw UNAUTHORIZED for orgProcedure if org is missing in ctx", async () => {
    // Mock authenticated user but no org
    (vi.mocked(auth) as any).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com" },
      expires: "",
    });

    vi.mocked(db.query.users.findFirst).mockResolvedValue(null as any); // user not found in db or defaults fail

    const ctx = await createTRPCContext({ headers: new Headers() });
    ctx.org = null; // force no org context

    const caller = appRouter.createCaller(ctx);

    await expect(caller.org.getOrg()).rejects.toThrowError(
      /Organization context required/
    );
  });

  it("should throw FORBIDDEN for requireOrgRole if user lacks required role", async () => {
    // Mock user with 'member' role
    (vi.mocked(auth) as any).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com" },
      expires: "",
    });

    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      name: "Test User",
      activeOrgId: "org_1",
    } as any);

    vi.mocked(db.query.orgMembers.findFirst).mockResolvedValue({
      id: "member_1",
      orgId: "org_1",
      userId: "user_1",
      role: "member", // regular member
    } as any);

    vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
      id: "org_1",
      name: "Test Org",
    } as any);

    const ctx = await createTRPCContext({ headers: new Headers() });
    const caller = appRouter.createCaller(ctx);

    // updateOrgName requires admin or owner role
    await expect(
      caller.org.updateOrgName({ name: "New Name" })
    ).rejects.toThrowError(/Insufficient organization permissions/);
  });

  it("should succeed for requireOrgRole if user is owner/admin", async () => {
    (vi.mocked(auth) as any).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com" },
      expires: "",
    });

    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "user_1",
      name: "Test User",
      activeOrgId: "org_1",
    } as any);

    vi.mocked(db.query.orgMembers.findFirst).mockResolvedValue({
      id: "member_1",
      orgId: "org_1",
      userId: "user_1",
      role: "owner", // owner
    } as any);

    vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
      id: "org_1",
      name: "Test Org",
    } as any);

    const ctx = await createTRPCContext({ headers: new Headers() });
    const caller = appRouter.createCaller(ctx);

    // Mock update operation
    const mockUpdateRes = [{ id: "org_1", name: "New Name" }];
    const mockReturning = vi.fn().mockResolvedValue(mockUpdateRes);
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        returning: mockReturning,
      }),
    } as any);

    const result = await caller.org.updateOrgName({ name: "New Name" });
    expect(result?.name).toBe("New Name");
  });
});
