import * as Sentry from "@sentry/nextjs";

/**
 * Server/edge Sentry init. A no-op unless SENTRY_DSN is configured, so this is
 * safe to ship without an account — set the DSN in production to activate it.
 */
export function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      enabled: Boolean(process.env.SENTRY_DSN),
      tracesSampleRate: 0.1,
      // Never let error reporting capture sensitive payloads.
      sendDefaultPii: false,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
