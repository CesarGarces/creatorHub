import { Module } from "@nestjs/common";
import { StorageModule } from "@creator-hub/storage";
import { AssetEngagementController } from "./asset-engagement.controller";
import { AssetEngagementService } from "./asset-engagement.service";

/** Likes & views of a user's assets (ARCHITECTURE.md §2f). */
@Module({
  imports: [StorageModule],
  controllers: [AssetEngagementController],
  providers: [AssetEngagementService],
})
export class AssetEngagementModule {}
