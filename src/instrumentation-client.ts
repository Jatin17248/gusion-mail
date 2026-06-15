import * as Sentry from "@sentry/nextjs";

/**
 * Browser Sentry init. A no-op unless NEXT_PUBLIC_SENTRY_DSN is configured.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
