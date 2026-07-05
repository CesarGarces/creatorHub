import { Injectable, OnModuleDestroy } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

/**
 * Sentry Service for Creator Hub
 *
 * Provides a clean NestJS interface for:
 * - Setting user context (userId, plan, email)
 * - Adding breadcrumbs (what happened before an error)
 * - Capturing exceptions with extra data
 * - Creating performance spans
 * - Flushing events on shutdown (critical for Render)
 *
 * Usage:
 *   constructor(private readonly sentry: SentryService) {}
 *
 *   // Add breadcrumb
 *   this.sentry.addBreadcrumb("ai.api_call", "Calling OpenAI API", { model: "gpt-4o" });
 *
 *   // Capture error with context
 *   this.sentry.captureException(error, { userId: "123", toolId: "thumbnail" });
 *
 *   // Set user for subsequent events
 *   this.sentry.setUser({ id: "123", email: "user@example.com", plan: "PRO" });
 */

interface SentryUser {
  id: string;
  email?: string;
  plan?: string;
  role?: string;
}

interface BreadcrumbData {
  [key: string]: unknown;
}

@Injectable()
export class SentryService implements OnModuleDestroy {
  // ─── User Context ────────────────────────────────────────────────────────

  /**
   * Set the current user context for all subsequent Sentry events.
   * Call this after authentication (e.g., in a guard or interceptor).
   */
  setUser(user: SentryUser): void {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    });

    // Plan/role go as tags (not user data)
    if (user.plan) {
      this.setTag("user.plan", user.plan);
    }
    if (user.role) {
      this.setTag("user.role", user.role);
    }
  }

  /**
   * Clear user context (e.g., on logout).
   */
  clearUser(): void {
    Sentry.setUser(null);
  }

  // ─── Breadcrumbs ──────────────────────────────────────────────────────────

  /**
   * Add a breadcrumb — a "miga de pan" that records what happened before an error.
   *
   * Examples:
   *   addBreadcrumb("ui.click", "User clicked Generate")
   *   addBreadcrumb("ai.api_call", "Calling OpenAI API", { model: "gpt-4o", userId: "123" })
   *   addBreadcrumb("payment.webhook", "MercadoPago webhook received", { eventId: "evt_123" })
   */
  addBreadcrumb(
    category: string,
    message: string,
    data?: BreadcrumbData,
    level: Sentry.SeverityLevel = "info",
  ): void {
    Sentry.addBreadcrumb({
      type: "default",
      category,
      message,
      level,
      data: data || {},
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Add an HTTP breadcrumb (for outgoing API calls).
   */
  addHttpBreadcrumb(
    method: string,
    url: string,
    statusCode?: number,
    duration?: number,
  ): void {
    this.addBreadcrumb(
      "http",
      `${method} ${url} ${statusCode ? `→ ${statusCode}` : ""}`,
      {
        method,
        url,
        status_code: statusCode,
        duration,
      },
      statusCode && statusCode >= 400 ? "warning" : "info",
    );
  }

  /**
   * Add a navigation breadcrumb (for route changes).
   */
  addNavigationBreadcrumb(from: string, to: string): void {
    this.addBreadcrumb("navigation", `Navigated from ${from} to ${to}`, {
      from,
      to,
    });
  }

  // ─── Tags ────────────────────────────────────────────────────────────────

  /**
   * Set a tag for grouping/filtering in Sentry dashboard.
   * Tags are indexed and searchable.
   */
  setTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  /**
   * Set multiple tags at once.
   */
  setTags(tags: Record<string, string>): void {
    Object.entries(tags).forEach(([key, value]) => {
      Sentry.setTag(key, value);
    });
  }

  // ─── Context ──────────────────────────────────────────────────────────────

  /**
   * Set extra context data (attached to events but not searchable).
   */
  setExtra(key: string, value: unknown): void {
    Sentry.setExtra(key, value);
  }

  /**
   * Set context for a specific key (visible in "Context" section of event).
   */
  setContext(key: string, context: Record<string, unknown>): void {
    Sentry.setContext(key, context);
  }

  // ─── Error Capture ────────────────────────────────────────────────────────

  /**
   * Capture an exception with optional context.
   *
   * Usage:
   *   try {
   *     await this.openAiService.generate(...);
   *   } catch (error) {
   *     this.sentry.captureException(error, {
   *       userId: user.id,
   *       toolId: "thumbnail-generator",
   *       provider: "openai",
   *       model: "dall-e-3",
   *     });
   *     throw error; // Re-throw after capturing
   *   }
   */
  captureException(
    error: unknown,
    extraData?: Record<string, unknown>,
  ): string {
    return Sentry.withScope((scope) => {
      if (extraData) {
        Object.entries(extraData).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      return Sentry.captureException(error);
    });
  }

  /**
   * Capture a message (non-error event).
   *
   * Usage:
   *   this.sentry.captureMessage("Payment failed for user 123", "error");
   *   this.sentry.captureMessage("Rate limit reached", "warning");
   */
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = "info",
  ): string {
    return Sentry.captureMessage(message, level);
  }

  // ─── Performance Spans ───────────────────────────────────────────────────

  /**
   * Execute a callback within a performance span.
   *
   * Usage:
   *   const result = await this.sentry.startSpan(
   *     { op: "ai.generate_image", name: "OpenAI DALL-E" },
   *     async (span) => {
   *       const result = await this.openAiService.generateImage(...);
   *       span?.setAttribute("model", "dall-e-3");
   *       return result;
   *     }
   *   );
   */
  async startSpan<T>(
    options: { op: string; name: string },
    callback: (span: Sentry.Span | undefined) => Promise<T>,
  ): Promise<T> {
    return Sentry.startSpan(options, callback);
  }

  // ─── Flush & Shutdown ────────────────────────────────────────────────────

  /**
   * Flush pending events to Sentry.
   * CRITICAL for Render: must complete before process exits.
   *
   * @param timeoutMs - Max time to wait for flush (default: 5000ms)
   * @returns true if flushed successfully, false if timed out
   */
  async flush(timeoutMs = 5000): Promise<boolean> {
    try {
      const result = await Sentry.flush(timeoutMs);
      if (!result) {
        console.warn(
          `[Sentry] Flush timed out after ${timeoutMs}ms. Some events may be lost.`,
        );
      }
      return result;
    } catch (error) {
      console.error("[Sentry] Error during flush:", error);
      return false;
    }
  }

  /**
   * Close Sentry transport and flush remaining events.
   * Call this in NestJS onModuleDestroy or process 'exit' handler.
   */
  async close(timeoutMs = 5000): Promise<void> {
    try {
      await Sentry.close(timeoutMs);
      console.log("[Sentry] Closed successfully.");
    } catch (error) {
      console.error("[Sentry] Error during close:", error);
    }
  }

  // ─── NestJS Lifecycle ────────────────────────────────────────────────────

  /**
   * Called automatically when the NestJS module is destroyed.
   * Ensures all events are flushed before Render shuts down the process.
   */
  async onModuleDestroy(): Promise<void> {
    console.log("[Sentry] Module destroying — flushing events...");
    await this.flush(5000);
  }
}
