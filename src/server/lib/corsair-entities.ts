export function dedupeByEntityId<
  T extends { entity_id: string; updated_at: Date },
>(items: T[]): T[] {
  const byEntityId = new Map<string, T>();
  for (const item of items) {
    const existing = byEntityId.get(item.entity_id);
    if (!existing || item.updated_at > existing.updated_at) {
      byEntityId.set(item.entity_id, item);
    }
  }
  return Array.from(byEntityId.values());
}

export function sortMessagesNewestFirst<
  T extends { timestamp: number },
>(messages: T[]): T[] {
  return [...messages].sort((a, b) => b.timestamp - a.timestamp);
}

export function messageTimestamp(
  internalDate?: string | null,
  createdAt?: Date | null,
): number {
  if (internalDate) return Number(internalDate);
  if (createdAt) return createdAt.getTime();
  return 0;
}
