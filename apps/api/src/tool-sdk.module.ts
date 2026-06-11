import { Module, Global } from "@nestjs/common";
import { ToolRegistry, ToolDiscoveryService } from "@creator-hub/tool-sdk";

@Global()
@Module({
  providers: [ToolRegistry, ToolDiscoveryService],
  exports: [ToolRegistry, ToolDiscoveryService],
})
export class ToolSdkModule {}
