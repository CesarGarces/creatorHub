import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthTokenGuard } from "./health-token.guard";

@Module({
  controllers: [HealthController],
  providers: [HealthTokenGuard],
})
export class HealthModule {}
