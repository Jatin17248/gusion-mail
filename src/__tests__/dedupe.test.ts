import { describe, it, expect } from "vitest";
import { dedupeByEntityId, sortMessagesNewestFirst, messageTimestamp } from "../server/lib/corsair-entities";

describe("dedupeByEntityId", () => {
  it("should remove duplicates and keep the one with the latest updated_at", () => {
    const items = [
      { entity_id: "1", updated_at: new Date("2026-06-01"), val: "old" },
      { entity_id: "2", updated_at: new Date("2026-06-02"), val: "only-one" },
      { entity_id: "1", updated_at: new Date("2026-06-03"), val: "newest" },
      { entity_id: "1", updated_at: new Date("2026-06-02"), val: "middle" },
    ];

    const result = dedupeByEntityId(items);
    expect(result).toHaveLength(2);
    
    const item1 = result.find(i => i.entity_id === "1");
    const item2 = result.find(i => i.entity_id === "2");

    expect(item1?.val).toBe("newest");
    expect(item2?.val).toBe("only-one");
  });

  it("should return empty array if input is empty", () => {
    expect(dedupeByEntityId([])).toEqual([]);
  });
});

describe("sortMessagesNewestFirst", () => {
  it("should sort messages in descending order of timestamp", () => {
    const messages = [
      { timestamp: 1000, id: "old" },
      { timestamp: 3000, id: "newest" },
      { timestamp: 2000, id: "middle" },
    ];

    const result = sortMessagesNewestFirst(messages);
    expect(result).toEqual([
      { timestamp: 3000, id: "newest" },
      { timestamp: 2000, id: "middle" },
      { timestamp: 1000, id: "old" },
    ]);
  });
});

describe("messageTimestamp", () => {
  it("should prioritize internalDate over createdAt", () => {
    const timestamp = messageTimestamp("1234567890", new Date("2026-06-01"));
    expect(timestamp).toBe(1234567890);
  });

  it("should use createdAt if internalDate is missing", () => {
    const date = new Date("2026-06-01");
    const timestamp = messageTimestamp(null, date);
    expect(timestamp).toBe(date.getTime());
  });

  it("should return 0 if both are missing", () => {
    const timestamp = messageTimestamp(null, null);
    expect(timestamp).toBe(0);
  });
});
