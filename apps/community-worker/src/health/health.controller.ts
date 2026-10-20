import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { HealthTokenGuard } from "./health-token.guard";

/**
 * Authenticated liveness endpoint for external uptime monitors.
 *
 * It intentionally does NOT check PostgreSQL, Redis or the channel
 * connectors:
 * - a liveness probe must stay cheap and fast;
 * - checking dependencies on every cron tick creates unnecessary load;
 * - dependency health belongs to a separate readiness/deep-check design.
 *
 * The response is deliberately minimal: no version, uptime, environment,
 * host names or dependency status.
 */
@Controller("health")
@UseGuards(HealthTokenGuard)
export class HealthController {
  @Get()
  @Header("Cache-Control", "no-store")
  @Header("X-Content-Type-Options", "nosniff")
  check(): { status: "ok" } {
    return { status: "ok" };
  }
}
