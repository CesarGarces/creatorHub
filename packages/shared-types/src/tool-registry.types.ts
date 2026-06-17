export interface ToolManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  icon?: string;
  category: ToolCategory;
  permissions: ToolPermission[];
  creditsPerUse: number;
  configSchema?: Record<string, unknown>;
  frontend: {
    routes: ToolRoute[];
    components?: Record<string, string>;
  };
  backend: {
    modulePath: string;
    events: string[];
  };
  status: ToolStatus;
}

export type ToolCategory =
  | "thumbnail"
  | "title"
  | "stream"
  | "video"
  | "social"
  | "analytics"
  | "design"
  | "writing"
  | "translator"
  | "other";

export interface ToolRoute {
  path: string;
  component: string;
  title: string;
  icon?: string;
  showInNav?: boolean;
}

export interface ToolPermission {
  action: string;
  resource: string;
  description?: string;
}

export type ToolStatus = "active" | "inactive" | "beta" | "deprecated";

export interface ToolConfig {
  enabled: boolean;
  creditsPerUse: number;
  maxUsesPerDay?: number;
  allowedRoles?: string[];
  providerOverrides?: Record<string, string>;
}
