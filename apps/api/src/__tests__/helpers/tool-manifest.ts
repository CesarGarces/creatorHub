import type { ToolManifest } from "@creator-hub/shared-types";

/** Builds a valid ToolManifest for tests; override only what matters. */
export function toolManifest(
  overrides: Partial<ToolManifest> = {},
): ToolManifest {
  const id = overrides.id ?? "thumbnail-generator";
  return {
    id,
    name: "Thumbnail Generator",
    description: "Creates video thumbnails",
    version: "1.0.0",
    category: "thumbnail",
    permissions: [],
    creditsPerUse: 10,
    frontend: {
      routes: [{ path: `/tools/${id}`, component: "Page", title: "Page" }],
    },
    backend: { modulePath: `@creator-hub/${id}`, events: [] },
    status: "active",
    ...overrides,
  };
}
