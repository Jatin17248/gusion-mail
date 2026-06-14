import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

// Mock database and schemas
vi.mock("@/server/db", () => {
  return {
    db: {
      query: {
        apiKeys: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

import { db } from "@/server/db";
import { validateApiKey } from "@/server/lib/api-auth";

// 1. Simple copy of personalize helper to verify interpolation logic
function personalize(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), val);
  }
  return result;
}

// 2. Simple copy of matchConditions to verify rule matching logic
function matchConditions(
  msg: { subject: string; from: string; body: string; priority: string },
  conditions: any[]
): boolean {
  if (!conditions || conditions.length === 0) return false;
  for (const cond of conditions) {
    const fieldVal = (msg[cond.field as keyof typeof msg] || "").toLowerCase();
    const targetVal = (cond.value || "").toLowerCase();

    switch (cond.operator) {
      case "equals":
        if (fieldVal !== targetVal) return false;
        break;
      case "contains":
        if (!fieldVal.includes(targetVal)) return false;
        break;
      case "starts_with":
        if (!fieldVal.startsWith(targetVal)) return false;
        break;
      case "ends_with":
        if (!fieldVal.endsWith(targetVal)) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

describe("Developer, Automation & Bulk Campaign Core Logic", () => {
  describe("Phase 13: Automation Condition Matcher", () => {
    const msg = {
      subject: "Important billing request",
      from: "billing@client.com",
      body: "Please upgrade my account.",
      priority: "high",
    };

    it("should match contains operator on subject", () => {
      const conds = [{ field: "subject", operator: "contains", value: "billing" }];
      expect(matchConditions(msg, conds)).toBe(true);
    });

    it("should match equals operator on from address", () => {
      const conds = [{ field: "from", operator: "equals", value: "billing@client.com" }];
      expect(matchConditions(msg, conds)).toBe(true);
    });

    it("should match starts_with on body", () => {
      const conds = [{ field: "body", operator: "starts_with", value: "please" }];
      expect(matchConditions(msg, conds)).toBe(true);
    });

    it("should not match if a single condition fails", () => {
      const conds = [
        { field: "subject", operator: "contains", value: "billing" },
        { field: "priority", operator: "equals", value: "urgent" }, // fails
      ];
      expect(matchConditions(msg, conds)).toBe(false);
    });
  });

  describe("Phase 14: API Key Token Authentication", () => {
    it("should resolve organization ID and scopes for valid active keys", async () => {
      const rawKey = "gsn_live_abcdef123456";
      const hashed = crypto.createHash("sha256").update(rawKey).digest("hex");

      vi.mocked(db.query.apiKeys.findFirst).mockResolvedValue({
        id: "key_1",
        orgId: "org_123",
        name: "Test Key",
        hashedKey: hashed,
        scopes: JSON.stringify(["messages:send", "tickets:read"]),
        isActive: true,
      } as any);

      const result = await validateApiKey(`Bearer ${rawKey}`);
      expect(result).not.toBeNull();
      expect(result?.orgId).toBe("org_123");
      expect(result?.scopes).toContain("messages:send");
      expect(result?.scopes).toContain("tickets:read");
    });

    it("should return null if key is marked inactive", async () => {
      const rawKey = "gsn_live_inactive";
      const hashed = crypto.createHash("sha256").update(rawKey).digest("hex");

      vi.mocked(db.query.apiKeys.findFirst).mockResolvedValue({
        id: "key_2",
        orgId: "org_123",
        hashedKey: hashed,
        scopes: "[]",
        isActive: false,
      } as any);

      const result = await validateApiKey(`Bearer ${rawKey}`);
      expect(result).toBeNull();
    });

    it("should return null for invalid tokens", async () => {
      vi.mocked(db.query.apiKeys.findFirst).mockResolvedValue(undefined as any);
      const result = await validateApiKey("Bearer invalid_token");
      expect(result).toBeNull();
    });
  });

  describe("Phase 15: Bulk Campaign Personalization Parser", () => {
    it("should interpolate template variables correctly", () => {
      const template = "Hello {{ firstName }}, welcome to {{company}}!";
      const vars = {
        firstName: "Jane",
        company: "Acme Corp",
      };

      const output = personalize(template, vars);
      expect(output).toBe("Hello Jane, welcome to Acme Corp!");
    });

    it("should leave unmatched variable tokens intact", () => {
      const template = "Hello {{ firstName }}, your ticket is {{ ticketId }}.";
      const vars = {
        firstName: "Jane",
      };

      const output = personalize(template, vars);
      expect(output).toBe("Hello Jane, your ticket is {{ ticketId }}.");
    });
  });
});
