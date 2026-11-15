import { Module } from "@nestjs/common";
import { ContentPlannerController } from "./content-planner.controller";
import { ContentPlannerService } from "./content-planner.service";

@Module({
  controllers: [ContentPlannerController],
  providers: [ContentPlannerService],
  exports: [ContentPlannerService],
})
export class ContentPlannerModule {}
