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
import { Prisma } from "@creator-hub/database";

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
 * - 499: NOT captured (client closed the request, e.g. a cancelled analysis)
 * - 429: CAPTURED (rate limit = operational issue)
 * - 400/422: CAPTURED (possible validation bug)
 * - 5xx: ALWAYS CAPTURED (server-side bugs)
 *
 * Registered globally in main.ts via:
 *   app.useGlobalFilters(new SentryExceptionFilter());
 */

/** Nginx-style status for requests the client abandoned. */
const CLIENT_CLOSED_REQUEST = 499;

/** Request body sanitization limits (see sanitizeBody). */
const SENSITIVE_FIELDS = ["password", "token", "secret", "apiKey"];
const MAX_STRING = 200;
const MAX_ITEMS = 10;
const MAX_DEPTH = 4;

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

  /**
   * Resolve an HttpException-like object. Workspace packages can resolve a
   * different physical copy of @nestjs/common, so `instanceof HttpException`
   * is not reliable across package boundaries. Duck typing keeps 401/403/404
   * responses from being downgraded to 500.
   */
  private getHttpException(exception: unknown): HttpException | null {
    if (exception instanceof HttpException) return exception;

    const candidate = exception as {
      getStatus?: () => number;
      getResponse?: () => unknown;
    } | null;
    if (
      candidate &&
      typeof candidate.getStatus === "function" &&
      typeof candidate.getResponse === "function"
    ) {
      const status = candidate.getStatus();
      if (typeof status === "number" && status >= 100 && status <= 599) {
        return exception as HttpException;
      }
    }
    return null;
  }

  private getHttpStatus(exception: unknown): number {
    const httpException = this.getHttpException(exception);
    if (httpException) {
      return httpException.getStatus();
    }
    // Defense in depth: an unhandled Prisma unique-constraint violation
    // (P2002, e.g. a lost duplicate-registration race) is a client conflict,
    // never a 500. Code paths should still handle P2002 locally with a
    // domain-specific message — this is the global safety net.
    if (this.isPrismaUniqueViolation(exception)) {
      return HttpStatus.CONFLICT;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private isPrismaUniqueViolation(exception: unknown): boolean {
    return (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === "P2002"
    );
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

    // Ignore 409 Conflict (expected duplicate/unique conflicts — fast-path
    // domain checks and rare lost races, both are client errors, not bugs)
    if (status === HttpStatus.CONFLICT) return true;

    // Ignore 499 Client Closed Request (the user cancelled/left — nothing
    // failed, e.g. a cancelled Video Clipper analysis)
    if (status === CLIENT_CLOSED_REQUEST) return true;

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
   * Sanitize request body before sending to Sentry, at every depth:
   * sensitive fields filtered, long strings (user prompts, base64 keyframes)
   * truncated, long arrays capped and deep nesting cut — so user content and
   * multi-megabyte payloads never reach Sentry.
   */
  private sanitizeBody(body: unknown, depth = 0): unknown {
    if (typeof body === "string") {
      return body.length > MAX_STRING
        ? body.substring(0, MAX_STRING) + "...[truncated]"
        : body;
    }
    if (!body || typeof body !== "object") return body;
    if (depth >= MAX_DEPTH) return "[Truncated]";

    if (Array.isArray(body)) {
      const items = body
        .slice(0, MAX_ITEMS)
        .map((item) => this.sanitizeBody(item, depth + 1));
      if (body.length > MAX_ITEMS) {
        items.push(`...[${body.length - MAX_ITEMS} more]`);
      }
      return items;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      sanitized[key] = SENSITIVE_FIELDS.includes(key)
        ? "[Filtered]"
        : this.sanitizeBody(value, depth + 1);
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
    const httpException = this.getHttpException(exception);
    if (httpException) {
      const exceptionResponse = httpException.getResponse();
      response.status(status).json(exceptionResponse);
    } else if (this.isPrismaUniqueViolation(exception)) {
      // Don't leak which unique field conflicted (information disclosure):
      // a generic conflict message is enough for the client to retry sanely.
      response.status(status).json({
        statusCode: status,
        message: "A resource with the same unique value already exists",
        error: "Conflict",
      });
    } else {
      response.status(status).json({
        statusCode: status,
        message: "Internal server error",
        error: "Internal Server Error",
      });
    }
  }
}
