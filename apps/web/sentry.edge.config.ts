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
  // Production: 20% of traces (edge runtime)
  // Development: 100% (full visibility)
  tracesSampleRate: isProduction ? 0.2 : 1.0,

  // ─── PII & Privacy ──────────────────────────────────────────────────────
  sendDefaultPii: false,

  // ─── Breadcrumbs ─────────────────────────────────────────────────────────
  maxBreadcrumbs: 30,
});
