import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { prisma } from "@creator-hub/database";

@Controller()
@SkipThrottle()
export class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  async ready() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "ready",
        database: "up",
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "not_ready",
        database: "down",
      });
    }
  }
}
