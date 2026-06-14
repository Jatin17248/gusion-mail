import posthog from "posthog-js";

// Client-side initialization
if (typeof window !== "undefined") {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";
  if (posthogKey) {
    try {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
        },
      });
    } catch (err) {
      console.warn("Failed to initialize PostHog on client:", err);
    }
  }
}

export function trackEvent(
  userId: string | null | undefined,
  eventName: string,
  properties: Record<string, unknown> = {}
) {
  const distinctId = userId ?? "anonymous";

  // Client-side tracking using posthog-js
  if (typeof window !== "undefined") {
    try {
      if (posthog.__loaded) {
        posthog.capture(eventName, {
          distinct_id: distinctId,
          ...properties,
        });
      } else {
        console.log(`[Analytics Client STUB]: ${eventName} for ${distinctId}`, properties);
      }
    } catch (err) {
      console.warn("Analytics capture error on client:", err);
    }
    return;
  }

  // Server-side tracking using fetch
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!posthogKey) {
    console.log(`[Analytics Server STUB]: ${eventName} for ${distinctId}`, properties);
    return;
  }

  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";
  fetch(`${posthogHost}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: posthogKey,
      event: eventName,
      properties: {
        distinct_id: distinctId,
        $lib: "gusion-mail-server",
        ...properties,
      },
    }),
  }).catch((err) => {
    console.warn("Analytics capture error on server:", err);
  });
}
