import { Module } from "@nestjs/common";
import { StyleContextService } from "./style/style-context.service";

/**
 * Shared community-bot building blocks. Imported by both the API
 * (playground previews) and the community-worker (live replies) so the
 * creator's voice is generated identically in both processes.
 */
@Module({
  providers: [StyleContextService],
  exports: [StyleContextService],
})
export class CommunityBotModule {}
