import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import * as Sentry from "@sentry/nestjs";

/**
 * Sentry Exception Filter
 *
 * Captures exceptions and reports them to Sentry with:
 * - HTTP request context (method, url, body, headers)
 * - User context (if available)
 * - Breadcrumbs trail
 * - Appropriate severity level
 *
 * Filtering strategy:
 * - 401/403: NOT captured (expected auth/authorization failures)
 * - 404: NOT captured (client requesting nonexistent resource)
 * - 429: CAPTURED (rate limit = operational issue)
 * - 400/422: CAPTURED (possible validation bug)
 * - 5xx: ALWAYS CAPTURED (server-side bugs)
 *
 * Registered globally in main.ts via:
 *   app.useGlobalFilters(new SentryExceptionFilter());
 */

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine HTTP status code
    const status = this.getHttpStatus(exception);

    // ─── Filtering: Don't capture expected client errors ────────────────
    if (this.shouldIgnore(status, request)) {
      // Still send the response to the client, just don't report to Sentry
      this.sendResponse(response, status, exception);
      return;
    }

    // ─── Capture to Sentry ──────────────────────────────────────────────
    Sentry.withScope((scope) => {
      // Set HTTP request context
      scope.setTag("http.method", request.method);
      scope.setTag("http.url", request.url);
      scope.setTag("http.status_code", String(status));

      // Set request data (body, params, query)
      scope.setExtra("http.request.body", this.sanitizeBody(request.body));
      scope.setExtra("http.request.params", request.params);
      scope.setExtra("http.request.query", request.query);

      // Set user context (if authenticated)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = (request as any).user;
      if (user) {
        Sentry.setUser({
          id: user.id || user.sub,
          email: user.email,
        });
        if (user.plan) scope.setTag("user.plan", user.plan);
      }

      // Set fingerprint for better grouping
      // Group by: method + url + status_code (not by exception message)
      scope.setFingerprint([
        "{{ method }}",
        "{{ http.url }}",
        "{{ http.status_code }}",
      ]);

      // Set severity based on status code
      scope.setLevel(this.getSeverityLevel(status));

      // Capture the exception
      Sentry.captureException(exception);
    });

    // ─── Log locally (for Render logs) ──────────────────────────────────
    this.logger.error(
      `[${request.method}] ${request.url} → ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    // ─── Send response to client ────────────────────────────────────────
    this.sendResponse(response, status, exception);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Determine if we should ignore this exception (not send to Sentry).
   * Returns true for expected client errors that aren't bugs.
   */
  private shouldIgnore(status: number, request: Request): boolean {
    // Ignore 401 Unauthorized (users without session, expired tokens)
    if (status === HttpStatus.UNAUTHORIZED) return true;

    // Ignore 403 Forbidden (users without permission — expected)
    if (status === HttpStatus.FORBIDDEN) return true;

    // Ignore 404 Not Found (client requesting nonexistent resource)
    if (status === HttpStatus.NOT_FOUND) return true;

    // Ignore health check endpoints
    if (request.url.includes("/health") || request.url.includes("/ready")) {
      return true;
    }

    // Ignore Swagger/OpenAPI endpoints
    if (request.url.includes("/api/docs")) return true;

    return false;
  }

  /**
   * Get Sentry severity level based on HTTP status.
   */
  private getSeverityLevel(status: number): Sentry.SeverityLevel {
    if (status >= 500) return "error";
    if (status === 429) return "warning"; // Rate limit = operational issue
    if (status >= 400) return "warning";
    return "info";
  }

  /**
   * Sanitize request body before sending to Sentry.
   * Removes passwords, tokens, and truncates long fields.
   */
  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== "object") return body;

    const sanitized = { ...(body as Record<string, unknown>) };

    // Remove sensitive fields
    const sensitiveFields = ["password", "token", "secret", "apiKey"];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = "[Filtered]";
      }
    }

    // Truncate long strings (user prompts)
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === "string" && value.length > 200) {
        sanitized[key] = value.substring(0, 200) + "...[truncated]";
      }
    }

    return sanitized;
  }

  /**
   * Send the appropriate response to the client.
   */
  private sendResponse(
    response: Response,
    status: number,
    exception: unknown,
  ): void {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      response.status(status).json(exceptionResponse);
    } else {
      response.status(status).json({
        statusCode: status,
        message: "Internal server error",
        error: "Internal Server Error",
      });
    }
  }
}
