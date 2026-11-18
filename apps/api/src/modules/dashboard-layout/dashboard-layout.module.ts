import { Module } from "@nestjs/common";
import { DashboardLayoutController } from "./dashboard-layout.controller";
import { DashboardLayoutService } from "./dashboard-layout.service";

/** Per-user dashboard widget layout (ARCHITECTURE.md §2f). */
@Module({
  controllers: [DashboardLayoutController],
  providers: [DashboardLayoutService],
  exports: [DashboardLayoutService],
})
export class DashboardLayoutModule {}
