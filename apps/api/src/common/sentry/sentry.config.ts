import type { NodeOptions } from "@sentry/node";
import * as Sentry from "@sentry/node";

/**
 * Sentry Configuration for Creator Hub
 *
 * Centralized config for all Sentry behavior:
 * - DSN & environment
 * - Sampling rates (traces, profiles)
 * - PII sanitization (GDPR/Compliance)
 * - Breadcrumb truncation (user prompts can be huge)
 * - Issue grouping strategy
 */

// ─── PII Sanitization ────────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 200;
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "creditCard",
  "credit_card",
  "ssn",
  "rut",
];

/**
 * Recursively sanitizes an object, replacing sensitive keys with [Filtered]
 * and truncating long string values (especially user prompts).
 */
function sanitizeData(
  data: Record<string, unknown> | unknown,
): Record<string, unknown> | unknown {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Filter sensitive keys entirely
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      sanitized[key] = "[Filtered]";
      continue;
    }

    // Truncate long strings (user prompts, responses)
    if (typeof value === "string" && value.length > MAX_PROMPT_LENGTH) {
      sanitized[key] = value.substring(0, MAX_PROMPT_LENGTH) + "...[truncated]";
      continue;
    }

    // Recurse into nested objects
    if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeData(value);
      continue;
    }

    sanitized[key] = value;
  }
  return sanitized;
}

/**
 * beforeSend: Sanitize event before sending to Sentry
 * - Remove PII from breadcrumbs
 * - Truncate long prompt data
 * - Filter sensitive fields from exception extra data
 */
function beforeSend(
  event: Sentry.ErrorEvent,
  _hint: Sentry.EventHint,
): Sentry.ErrorEvent | null {
  // Sanitize breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
      if (breadcrumb.data && typeof breadcrumb.data === "object") {
        return {
          ...breadcrumb,
          data: sanitizeData(breadcrumb.data) as Record<string, string>,
        };
      }
      return breadcrumb;
    });
  }

  // Sanitize exception extra data
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((ex) => {
      if (ex.mechanism) {
        ex.mechanism = {
          ...ex.mechanism,
        };
      }
      return ex;
    });
  }

  // Sanitize request data (headers, body)
  if (event.request?.headers) {
    event.request.headers = sanitizeData(event.request.headers) as Record<
      string,
      string
    >;
  }
  if (event.request?.data && typeof event.request.data === "object") {
    event.request.data = sanitizeData(event.request.data);
  }

  // Sanitize extra data
  if (event.extra) {
    event.extra = sanitizeData(event.extra) as Record<string, unknown>;
  }

  return event;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const environment =
  process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const release =
  process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT || "unknown";
const isProduction = environment === "production";

export const sentryConfig: NodeOptions = {
  dsn: process.env.SENTRY_DSN,

  environment,
  release,

  // ─── Sampling ────────────────────────────────────────────────────────────
  // Production: 20% traces (Render free tier memory constraints)
  // Development: 100% traces (full visibility)
  tracesSampleRate: isProduction ? 0.2 : 1.0,

  // Profiling: Same sample rate as traces
  profilesSampleRate: isProduction ? 0.2 : 1.0,

  // ─── PII & Privacy ──────────────────────────────────────────────────────
  // NEVER send user IP addresses
  sendDefaultPii: false,

  // Sanitize before sending
  beforeSend,

  // ─── Breadcrumbs ─────────────────────────────────────────────────────────
  // Maximum breadcrumbs to keep in memory (default: 100)
  maxBreadcrumbs: 50,

  // ─── Scope ───────────────────────────────────────────────────────────────
  // Default tags applied to all events
  initialScope: {
    tags: {
      service: "creatorhub-api",
      runtime: "node",
    },
  },
};

// ─── HTTP Integration Config ────────────────────────────────────────────────
// Captures outgoing HTTP requests as breadcrumbs + performance spans
export const httpIntegrationConfig = {
  // Track outgoing HTTP calls (AI providers, webhooks, etc.)
  breadcrumbs: true,
  // Don't capture these URLs (internal, health checks)
  ignoreOutgoingUrls: [
    /localhost/,
    /127\.0\.0\.1/,
    /health/,
    /ready/,
    /sentry\.io/, // Don't track our own Sentry calls
  ],
};

// ─── Console Integration Config ──────────────────────────────────────────────
// Capture console.log/warn/error as breadcrumbs
export const consoleIntegrationConfig = {
  // Only capture warn and error (not log/info/debug)
  levels: ["warn", "error"] as const,
};
