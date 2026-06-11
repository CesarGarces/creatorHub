import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ToolRegistry } from "@creator-hub/tool-sdk";
import { AnalyticsService } from "@creator-hub/analytics";
import { JwtAuthGuard, Roles, RolesGuard } from "@creator-hub/auth";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(
    private toolRegistry: ToolRegistry,
    private analytics: AnalyticsService
  ) {}

  @Get("dashboard")
  async getDashboard() {
    return this.analytics.getDashboardStats();
  }

  @Get("tools")
  async listTools() {
    return this.toolRegistry.getAll();
  }

  @Post("tools/toggle")
  async toggleTool(@Body("toolId") toolId: string, @Body("status") status: string) {
    // Toggle tool status
    return { success: true };
  }
}
