import { Redis } from "@upstash/redis";
import { env } from "@/env";

interface CacheStore {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, options?: { ex: number }) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
}

let redis: CacheStore;

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  // Mock fallback in memory
  const store = new Map<string, { val: unknown; expiresAt?: number }>();
  redis = {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.val;
    },
    async set(key: string, value: unknown, options?: { ex: number }) {
      const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : undefined;
      store.set(key, { val: value, expiresAt });
      return "OK";
    },
    async del(key: string) {
      store.delete(key);
      return 1;
    },
  };
}

export { redis };
export type { CacheStore };
