import { env } from "@/env";

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5 || !obj) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item, depth + 1));
  }

  if (typeof obj === "object" && obj !== null) {
    const redactedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("key") ||
        lowerKey.includes("body") ||
        lowerKey.includes("payload") ||
        lowerKey.includes("dek") ||
        lowerKey.includes("config")
      ) {
        redactedObj[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        redactedObj[key] = redact(value, depth + 1);
      } else {
        redactedObj[key] = value;
      }
    }
    return redactedObj;
  }

  return obj;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    const cleanMeta = meta ? (redact(meta) as Record<string, unknown>) : undefined;
    if (env.NODE_ENV === "production") {
      console.log(
        JSON.stringify({
          level: "info",
          timestamp: new Date().toISOString(),
          message,
          ...cleanMeta,
        })
      );
    } else {
      console.log(`[INFO] ${message}`, cleanMeta ? JSON.stringify(cleanMeta, null, 2) : "");
    }
  },

  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    const cleanMeta = meta ? (redact(meta) as Record<string, unknown>) : undefined;
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;

    if (env.NODE_ENV === "production") {
      console.error(
        JSON.stringify({
          level: "error",
          timestamp: new Date().toISOString(),
          message,
          error: errMessage,
          stack: errStack,
          ...cleanMeta,
        })
      );
    } else {
      console.error(
        `[ERROR] ${message} - Error: ${errMessage}`,
        errStack ? `\nStack: ${errStack}` : "",
        cleanMeta ? `\nMeta: ${JSON.stringify(cleanMeta, null, 2)}` : ""
      );
    }
  },
};
