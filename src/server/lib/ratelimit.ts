import { Ratelimit } from "@upstash/ratelimit";
import { type Redis } from "@upstash/redis";
import { redis } from "./redis";
import { env } from "@/env";

interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

let ratelimit: {
  limit: (key: string) => Promise<LimitResult>;
};

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: redis as Redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"), // 60 requests per minute
    analytics: true,
  });
} else {
  // Mock rate limiter that always allows requests
  ratelimit = {
    async limit() {
      return {
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
      };
    },
  };
}

export { ratelimit };
