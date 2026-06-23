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
import { getTenant } from "@/server/lib/tenant";

const mockDelete = vi.fn().mockResolvedValue(true);
const mockListByTenant = vi.fn().mockResolvedValue([{ id: "corsair_acc_1" }]);

vi.mock("corsair/orm", () => ({
  createCorsairOrm: vi.fn().mockImplementation(() => ({
    accounts: {
      listByTenant: mockListByTenant,
      delete: mockDelete,
    },
  })),
}));

vi.mock("corsair/db", () => ({
  createCorsairDatabase: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/db", () => {
  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };
  const mockUpdateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };
  return {
    conn: {},
    db: {
      query: {
        users: { findFirst: vi.fn() },
        referrals: { findMany: vi.fn(), findFirst: vi.fn() },
        templates: { findMany: vi.fn() },
        emailMeta: { findMany: vi.fn() },
        schedulingLinks: { findMany: vi.fn() },
        bookings: { findMany: vi.fn() },
        contacts: { findMany: vi.fn() },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "new_referral" }]),
        }),
      }),
      update: vi.fn().mockReturnValue(mockUpdateChain),
      delete: vi.fn().mockReturnValue(mockDeleteChain),
    },
  };
});

vi.mock("@/server/lib/corsair-setup", () => ({
  provisionCorsairTenant: vi.fn().mockResolvedValue(undefined),
  refreshCorsairTokens: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/server/lib/tenant", () => ({
  getTenant: vi.fn(),
}));

vi.mock("@/server/lib/plan-gate", () => ({
  hasActivePlanOrTrial: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/server/lib/ratelimit", () => ({
  ratelimit: {
    limit: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    del: vi.fn().mockResolvedValue(true),
  },
}));

describe("Growth & Compliance Routers", () => {
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

  describe("Referrals Router", () => {
    it("should query stats and invites correctly", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "user_123",
        referralCode: "HOST123",
        referredByCode: "FRIEND456",
      } as any);

      vi.mocked(db.query.referrals.findMany).mockResolvedValue([
        { id: "inv_1", referredEmail: "guest@example.com", status: "pending" },
      ] as any);

      const caller = appRouter.createCaller(mockCtx as any);
      const res = await caller.referral.getReferralStats();

      expect(res.referralCode).toBe("HOST123");
      expect(res.referredByCode).toBe("FRIEND456");
      expect(res.invites).toHaveLength(1);
    });

    it("should submit a referral and block self-referrals", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "user_123",
        email: "host@example.com",
        referralCode: "HOST123",
      } as any);

      const caller = appRouter.createCaller(mockCtx as any);

      await expect(
        caller.referral.submitReferral({ email: "host@example.com" })
      ).rejects.toThrow("You cannot refer yourself.");

      const result = await caller.referral.submitReferral({ email: "new_friend@example.com" });
      expect(result?.id).toBe("new_referral");
      expect(db.insert).toHaveBeenCalled();
    });

    it("should apply code and trigger trial extensions if pending invite matches", async () => {
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce({
          id: "user_123",
          email: "invitee@example.com",
          referralCode: "INVITEE12",
        } as any) // first call (invitee details)
        .mockResolvedValueOnce({
          id: "user_referrer",
          email: "referrer@example.com",
          referralCode: "CODE456",
        } as any); // second call (referrer details)

      vi.mocked(db.query.referrals.findFirst).mockResolvedValue({
        id: "ref_pending",
        referrerUserId: "user_referrer",
        referredEmail: "invitee@example.com",
        status: "pending",
      } as any);

      const caller = appRouter.createCaller(mockCtx as any);
      const res = await caller.referral.applyReferralCode({ code: "CODE456" });

      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled(); // Should update both users and referrals status
    });
  });

  describe("Compliance & Deletion Router", () => {
    it("should gather user data elements during exportData query", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "user_123",
        name: "Test User",
        email: "test@example.com",
      } as any);

      vi.mocked(db.query.templates.findMany).mockResolvedValue([{ id: "temp_1" }] as any);
      vi.mocked(db.query.emailMeta.findMany).mockResolvedValue([{ id: "meta_1" }] as any);
      vi.mocked(db.query.schedulingLinks.findMany).mockResolvedValue([{ id: "link_1" }] as any);
      vi.mocked(db.query.bookings.findMany).mockResolvedValue([{ id: "book_1" }] as any);
      vi.mocked(db.query.contacts.findMany).mockResolvedValue([{ id: "contact_1" }] as any);
      vi.mocked(db.query.referrals.findMany).mockResolvedValue([{ id: "ref_1" }] as any);

      const caller = appRouter.createCaller(mockCtx as any);
      const res = await caller.auth.exportData();

      expect(res.user.id).toBe("user_123");
      expect(res.templates).toHaveLength(1);
      expect(res.schedulingLinks).toHaveLength(1);
      expect(res.bookings).toHaveLength(1);
      expect(res.contacts).toHaveLength(1);
    });

    it("should call Corsair deletes and DB deletes on account purge", async () => {
      mockDelete.mockClear();
      mockListByTenant.mockClear();

      const caller = appRouter.createCaller(mockCtx as any);
      const res = await caller.auth.deleteAccount();

      expect(res.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith("corsair_acc_1");
      expect(db.delete).toHaveBeenCalled();
    });

    it("should update user settings in the database", async () => {
      const caller = appRouter.createCaller(mockCtx as any);
      const res = await caller.auth.updateSettings({ viralSignatureEnabled: false });

      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("Gmail Router & Signature Appending", () => {
    const mockSend = vi.fn();

    beforeEach(() => {
      mockSend.mockReset();
      mockSend.mockResolvedValue({ id: "msg_123", threadId: "thread_123" });
      vi.mocked(getTenant).mockReturnValue({
        gmail: {
          api: {
            messages: {
              send: mockSend,
            },
          },
        },
      } as any);
    });

    it("should append the viral signature to sendEmail if enabled", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "user_123",
        viralSignatureEnabled: true,
      } as any);

      const caller = appRouter.createCaller(mockCtx as any);
      await caller.gmail.sendEmail({
        to: "friend@example.com",
        subject: "Hello",
        body: "My message body",
      });

      expect(mockSend).toHaveBeenCalled();
      const callArgs = mockSend.mock.calls[0]?.[0] as { raw: string } | undefined;
      expect(callArgs).toBeDefined();
      const raw = callArgs!.raw;
      const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
      expect(decoded).toContain("My message body");
      expect(decoded).toContain("Sent with Gusion Mail - https://mail.gusion.in");
    });

    it("should NOT append the viral signature to sendEmail if disabled", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "user_123",
        viralSignatureEnabled: false,
      } as any);

      const caller = appRouter.createCaller(mockCtx as any);
      await caller.gmail.sendEmail({
        to: "friend@example.com",
        subject: "Hello",
        body: "My message body",
      });

      expect(mockSend).toHaveBeenCalled();
      const callArgs = mockSend.mock.calls[0]?.[0] as { raw: string } | undefined;
      expect(callArgs).toBeDefined();
      const raw = callArgs!.raw;
      const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
      expect(decoded).toContain("My message body");
      expect(decoded).not.toContain("Sent with Gusion Mail");
    });

    it("should append the viral signature to replyToEmail if enabled", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "user_123",
        viralSignatureEnabled: true,
      } as any);

      const caller = appRouter.createCaller(mockCtx as any);
      await caller.gmail.replyToEmail({
        to: "friend@example.com",
        subject: "Hello",
        body: "My reply body",
        threadId: "t123",
        inReplyTo: "msg_abc",
      });

      expect(mockSend).toHaveBeenCalled();
      const callArgs = mockSend.mock.calls[0]?.[0] as { raw: string } | undefined;
      expect(callArgs).toBeDefined();
      const raw = callArgs!.raw;
      const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
      expect(decoded).toContain("My reply body");
      expect(decoded).toContain("Sent with Gusion Mail - https://mail.gusion.in");
    });

    it("should retrieve emails filtered by tab", async () => {
      // Inbox paginates against the Gmail API (messages.list → cursor); each id is
      // hydrated via messages.get (which auto-caches the entity) and read back from
      // the entity cache. The "promotions" tab maps to a Gmail `category:promotions` query.
      const mockApiList = vi.fn().mockImplementation(({ q }: { q?: string }) =>
        Promise.resolve({
          messages: q?.includes("category:promotions")
            ? [{ id: "msg_promo_1" }]
            : [{ id: "msg_all_1" }],
          nextPageToken: undefined,
        }),
      );
      const mockApiGet = vi.fn().mockResolvedValue({});
      const mockFindMany = vi.fn().mockImplementation((ids: string[]) =>
        Promise.resolve(
          ids.map((id) => ({
            entity_id: id,
            updated_at: new Date(),
            data: {
              subject: id === "msg_promo_1" ? "Promo Subject" : "All Subject",
              from: "sender@example.com",
              internalDate: "1718361000000",
            },
          })),
        ),
      );
      vi.mocked(getTenant).mockReturnValue({
        gmail: {
          api: {
            messages: {
              list: mockApiList,
              get: mockApiGet,
            },
          },
          db: {
            messages: {
              findManyByEntityIds: mockFindMany,
            },
          },
        },
      } as any);

      // emailMeta join supplies the priority badge for msg_promo_1.
      vi.mocked(db.query.emailMeta.findMany).mockResolvedValue([
        { gmailMessageId: "msg_promo_1", priority: "normal", category: "promotions" }
      ] as any);

      const caller = appRouter.createCaller(mockCtx as any);

      // Test tab: all
      const resAll = await caller.gmail.searchEmails({ query: "", tab: "all" });
      expect(resAll.items).toHaveLength(1);
      expect(resAll.items[0]?.subject).toBe("All Subject");
      expect(resAll.nextCursor).toBeNull();

      // Test tab: promotions
      const resPromo = await caller.gmail.searchEmails({ query: "", tab: "promotions" });
      expect(resPromo.items).toHaveLength(1);
      expect(resPromo.items[0]?.subject).toBe("Promo Subject");
    });
  });
});
