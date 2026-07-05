import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import * as Sentry from "@sentry/nestjs";

/**
 * Sentry Performance Interceptor
 *
 * Tracks HTTP request performance and adds breadcrumbs for observability.
 *
 * Captures:
 * - Request duration (performance span)
 * - HTTP method, URL, status code
 * - User context (if authenticated)
 * - Breadcrumbs for request lifecycle
 *
 * Registered globally in main.ts via:
 *   app.useGlobalInterceptors(new SentryInterceptor());
 */

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SentryInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    // ─── Set User Context ───────────────────────────────────────────────
    const user = request.user;
    if (user) {
      Sentry.setUser({
        id: user.id || user.sub,
        email: user.email,
      });
      if (user.plan) Sentry.setTag("user.plan", user.plan);
    }

    // ─── Add Request Breadcrumb ─────────────────────────────────────────
    Sentry.addBreadcrumb({
      type: "http",
      category: "http",
      message: `${method} ${url} — Request received`,
      level: "info",
      data: {
        method,
        url,
        query: request.query,
        params: request.params,
        // Don't log body (PII risk) — only log presence
        hasBody: !!request.body && Object.keys(request.body).length > 0,
      },
    });

    // ─── Create Performance Span ────────────────────────────────────────
    return Sentry.startSpan(
      {
        op: "http.server",
        name: `${method} ${url}`,
      },
      (span) => {
        return next.handle().pipe(
          tap({
            next: () => {
              const duration = Date.now() - startTime;
              const response = context.switchToHttp().getResponse();
              const statusCode = response.statusCode;

              // Set span status
              if (statusCode >= 400) {
                span.setStatus({ code: 2, message: "HTTP Error" });
              } else {
                span.setStatus({ code: 0, message: "OK" });
              }

              // Set span data
              span.setAttributes({
                "http.method": method,
                "http.url": url,
                "http.status_code": statusCode,
                "http.response_time_ms": duration,
              });

              // Add response breadcrumb
              Sentry.addBreadcrumb({
                type: "http",
                category: "http",
                message: `${method} ${url} → ${statusCode} (${duration}ms)`,
                level:
                  statusCode >= 500
                    ? "error"
                    : statusCode >= 400
                      ? "warning"
                      : "info",
                data: {
                  method,
                  url,
                  status_code: statusCode,
                  duration_ms: duration,
                },
              });

              // Log slow requests (> 2 seconds)
              if (duration > 2000) {
                this.logger.warn(
                  `Slow request: ${method} ${url} took ${duration}ms`,
                );
              }
            },
            error: (error) => {
              const duration = Date.now() - startTime;

              // Set span error status
              span.setStatus({ code: 2, message: "Internal Error" });
              span.setAttributes({
                "http.method": method,
                "http.url": url,
                "http.response_time_ms": duration,
                error: true,
              });

              // Add error breadcrumb
              Sentry.addBreadcrumb({
                type: "default",
                category: "http",
                message: `${method} ${url} → Error (${duration}ms)`,
                level: "error",
                data: {
                  method,
                  url,
                  duration_ms: duration,
                  error_name: error instanceof Error ? error.name : "Unknown",
                  error_message:
                    error instanceof Error ? error.message : String(error),
                },
              });
            },
          }),
        );
      },
    );
  }
}
