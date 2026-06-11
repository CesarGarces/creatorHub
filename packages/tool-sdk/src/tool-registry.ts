import { Injectable } from "@nestjs/common";
import type { ToolManifest, ToolConfig, AIProvider } from "@creator-hub/shared-types";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class ToolRegistry {
  private tools = new Map<string, ToolManifest>();
  private logger = new Logger("ToolRegistry");

  register(manifest: ToolManifest): void {
    if (this.tools.has(manifest.id)) {
      this.logger.warn(`Tool already registered, overwriting: ${manifest.id}`);
    }
    this.tools.set(manifest.id, manifest);
    this.logger.info(`Tool registered: ${manifest.name} (${manifest.id})`);
  }

  unregister(toolId: string): void {
    this.tools.delete(toolId);
  }

  get(toolId: string): ToolManifest | undefined {
    return this.tools.get(toolId);
  }

  getAll(): ToolManifest[] {
    return Array.from(this.tools.values());
  }

  getActive(): ToolManifest[] {
    return this.getAll().filter((t) => t.status === "active" || t.status === "beta");
  }

  getByCategory(category: string): ToolManifest[] {
    return this.getAll().filter((t) => t.category === category);
  }

  getFrontendRoutes() {
    return this.getAll().flatMap((tool) =>
      tool.frontend.routes.map((route) => ({
        ...route,
        toolId: tool.id,
        toolName: tool.name,
      }))
    );
  }

  getPermissions() {
    return this.getAll().flatMap((tool) =>
      tool.permissions.map((perm) => ({
        ...perm,
        toolId: tool.id,
      }))
    );
  }
}
