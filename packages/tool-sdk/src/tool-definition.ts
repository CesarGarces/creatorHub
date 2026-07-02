import type {
  ToolManifest,
  ToolCategory,
  ToolPermission,
  ToolRoute,
  ChatInputParam,
} from "@creator-hub/shared-types";

export interface ToolManifestInput {
  id: string;
  name: string;
  description: string;
  version?: string;
  icon?: string;
  category: ToolCategory;
  permissions?: ToolPermission[];
  creditsPerUse?: number;
  chatInputParams?: ChatInputParam[];
  frontend: {
    routes: ToolRoute[];
  };
  backend: {
    module: any; // NestJS module class
    events?: string[];
  };
}

export class ToolDefinition {
  static create(input: ToolManifestInput): ToolManifest {
    return {
      id: input.id,
      name: input.name,
      description: input.description,
      version: input.version || "1.0.0",
      icon: input.icon,
      category: input.category,
      creditsPerUse: input.creditsPerUse || 10,
      permissions: input.permissions || [],
      configSchema: {},
      chatInputParams: input.chatInputParams || [],
      frontend: {
        routes: input.frontend.routes,
        components: {},
      },
      backend: {
        modulePath: input.backend.module.name || input.id,
        events: input.backend.events || [],
      },
      status: "active",
    };
  }
}
