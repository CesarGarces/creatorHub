import * as Sentry from "@sentry/nextjs";

const environment =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
  process.env.NODE_ENV ||
  "development";
const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE || "unknown";
const isProduction = environment === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment,
  release,

  // ─── Sampling ────────────────────────────────────────────────────────────
  // Production: 10% of traces (client-side performance)
  // Development: 100% (full visibility)
  tracesSampleRate: isProduction ? 0.1 : 1.0,

  // ─── Session Replay ──────────────────────────────────────────────────────
  // Captures user sessions on error (see exactly what user did)
  replaysSessionSampleRate: isProduction ? 0.01 : 0, // 1% in prod
  replaysOnErrorSampleRate: 1.0, // Always capture on error

  integrations: [
    Sentry.replayIntegration({
      // Mask all text content in replays (PII protection)
      maskAllText: true,
      // Block all media in replays
      blockAllMedia: true,
    }),
  ],

  // ─── PII & Privacy ──────────────────────────────────────────────────────
  sendDefaultPii: false,

  // ─── Breadcrumbs ─────────────────────────────────────────────────────────
  maxBreadcrumbs: 30,

  // ─── beforeSend ──────────────────────────────────────────────────────────
  beforeSend(event) {
    // Sanitize breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data && typeof breadcrumb.data === "object") {
          const sanitized: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(breadcrumb.data)) {
            // Filter sensitive keys
            if (
              ["password", "token", "secret", "apiKey"].some((k) =>
                key.toLowerCase().includes(k),
              )
            ) {
              sanitized[key] = "[Filtered]";
              continue;
            }
            // Truncate long strings
            if (typeof value === "string" && value.length > 200) {
              sanitized[key] = value.substring(0, 200) + "...[truncated]";
              continue;
            }
            sanitized[key] = value;
          }
          return { ...breadcrumb, data: sanitized };
        }
        return breadcrumb;
      });
    }

    return event;
  },
});
