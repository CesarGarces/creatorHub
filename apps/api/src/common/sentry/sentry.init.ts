/**
 * Sentry Early Initialization
 *
 * MUST be called BEFORE NestFactory.create() to capture:
 * - Bootstrap errors (module loading, dependency injection)
 * - Unhandled rejections
 * - Uncaught exceptions
 *
 * Usage in main.ts:
 *   import "./common/sentry/sentry.init";
 *   // ... later
 *   const app = await NestFactory.create(AppModule);
 */

import * as Sentry from "@sentry/nestjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { sentryConfig } from "./sentry.config";

// ─── Guard: Only init if DSN is configured ──────────────────────────────────
if (!process.env.SENTRY_DSN) {
  console.warn(
    "[Sentry] SENTRY_DSN not configured. Sentry is disabled. " +
      "Set SENTRY_DSN environment variable to enable error tracking.",
  );
}

// ─── Initialize Sentry ──────────────────────────────────────────────────────
// This runs at import time, before any NestJS modules load
Sentry.init({
  ...sentryConfig,

  // Add profiling integration (must be explicit)
  integrations: [nodeProfilingIntegration()],
});

console.log(
  `[Sentry] Initialized — environment: ${sentryConfig.environment}, release: ${sentryConfig.release}`,
);
