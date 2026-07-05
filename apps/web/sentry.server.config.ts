import * as Sentry from "@sentry/nextjs";

const environment =
  process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const release = process.env.SENTRY_RELEASE || "unknown";
const isProduction = environment === "production";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment,
  release,

  // ─── Sampling ────────────────────────────────────────────────────────────
  // Production: 20% of traces (server-side)
  // Development: 100% (full visibility)
  tracesSampleRate: isProduction ? 0.2 : 1.0,

  // ─── PII & Privacy ──────────────────────────────────────────────────────
  sendDefaultPii: false,

  // ─── Breadcrumbs ─────────────────────────────────────────────────────────
  maxBreadcrumbs: 50,

  // ─── beforeSend ──────────────────────────────────────────────────────────
  beforeSend(event) {
    // Sanitize request data
    if (event.request?.headers) {
      const sanitized: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.request.headers)) {
        if (
          ["authorization", "cookie", "x-api-key"].some((k) =>
            key.toLowerCase().includes(k),
          )
        ) {
          sanitized[key] = "[Filtered]";
        } else {
          sanitized[key] = value;
        }
      }
      event.request.headers = sanitized;
    }

    // Sanitize breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data && typeof breadcrumb.data === "object") {
          const sanitized: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(breadcrumb.data)) {
            if (
              ["password", "token", "secret", "apiKey"].some((k) =>
                key.toLowerCase().includes(k),
              )
            ) {
              sanitized[key] = "[Filtered]";
              continue;
            }
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
