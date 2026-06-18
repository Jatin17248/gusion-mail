"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No-op unless Sentry is configured.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#09090b",
            color: "#e4e4e7",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ textAlign: "center", padding: 24 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#f59e0b",
                marginBottom: 12,
              }}
            >
              Temporary issue
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              We hit a problem loading Gusion Mail
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#a1a1aa",
                maxWidth: 420,
                lineHeight: 1.6,
                margin: "0 auto",
              }}
            >
              This is usually temporary. You can try again now or head back to the homepage.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  border: "none",
                  borderRadius: 999,
                  background: "#f59e0b",
                  color: "#09090b",
                  fontWeight: 700,
                  padding: "10px 18px",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  borderRadius: 999,
                  border: "1px solid #27272a",
                  color: "#e4e4e7",
                  textDecoration: "none",
                  fontWeight: 600,
                  padding: "10px 18px",
                }}
              >
                Go to homepage
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
