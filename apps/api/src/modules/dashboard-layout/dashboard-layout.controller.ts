import { Body, Controller, Delete, Get, Put, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
import type { DashboardLayout } from "@creator-hub/shared-types";
import { DashboardLayoutService } from "./dashboard-layout.service";
import { UpdateDashboardLayoutDto } from "./dto/update-dashboard-layout.dto";

/**
 * Dashboard personalization (Settings → Dashboard, press-and-hold on the
 * dashboard). Next to `/user/favorites`: both are per-user UI preferences.
 */
@Controller("user/dashboard-layout")
@UseGuards(JwtAuthGuard)
export class DashboardLayoutController {
  constructor(private readonly layouts: DashboardLayoutService) {}

  @Get()
  getLayout(@CurrentUser("id") userId: string): Promise<DashboardLayout> {
    return this.layouts.getLayout(userId);
  }

  @Put()
  saveLayout(
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateDashboardLayoutDto,
  ): Promise<DashboardLayout> {
    return this.layouts.saveLayout(userId, dto.widgets);
  }

  @Delete()
  resetLayout(@CurrentUser("id") userId: string): Promise<DashboardLayout> {
    return this.layouts.resetLayout(userId);
  }
}
