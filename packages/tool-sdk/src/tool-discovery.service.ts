import { Injectable, OnModuleInit } from "@nestjs/common";
import { ToolRegistry } from "./tool-registry";
import { loadTools } from "./load-tools";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class ToolDiscoveryService implements OnModuleInit {
  private logger = new Logger("ToolDiscoveryService");

  constructor(private registry: ToolRegistry) {}

  onModuleInit() {
    this.discoverTools();
  }

  discoverTools() {
    const { manifests } = loadTools();

    for (const manifest of manifests) {
      this.registry.register(manifest);
    }

    this.logger.info(`Discovered ${manifests.length} tools`);
  }
}
