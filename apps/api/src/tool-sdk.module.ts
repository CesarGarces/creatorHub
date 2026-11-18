import { Module, Global } from "@nestjs/common";
import {
  AssistantActionRegistry,
  ToolRegistry,
  ToolDiscoveryService,
} from "@creator-hub/tool-sdk";

/**
 * Global: the tool registry (discovered manifests) and the assistant action
 * registry (what tools let the AI assistant do — see §14g "Actions").
 */
@Global()
@Module({
  providers: [ToolRegistry, ToolDiscoveryService, AssistantActionRegistry],
  exports: [ToolRegistry, ToolDiscoveryService, AssistantActionRegistry],
})
export class ToolSdkModule {}
