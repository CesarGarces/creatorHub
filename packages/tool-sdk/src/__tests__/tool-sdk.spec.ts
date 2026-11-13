import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolManifest } from "@creator-hub/shared-types";
import { ToolRegistry } from "../tool-registry";
import { ToolDefinition, type ToolManifestInput } from "../tool-definition";

class ThumbnailModule {}

function input(overrides: Partial<ToolManifestInput> = {}): ToolManifestInput {
  return {
    id: "thumbnail-generator",
    name: "Thumbnail Generator",
    description: "Creates thumbnails",
    category: "thumbnail",
    frontend: {
      routes: [
        {
          path: "/tools/thumbnail-generator",
          component: "Page",
          title: "Thumbs",
        },
      ],
    },
    backend: { module: ThumbnailModule },
    ...overrides,
  };
}

function manifest(overrides: Partial<ToolManifest> = {}): ToolManifest {
  return { ...ToolDefinition.create(input()), ...overrides };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("ToolDefinition.create", () => {
  it("fills in defaults for optional fields", () => {
    expect(ToolDefinition.create(input())).toEqual({
      id: "thumbnail-generator",
      name: "Thumbnail Generator",
      description: "Creates thumbnails",
      version: "1.0.0",
      icon: undefined,
      category: "thumbnail",
      creditsPerUse: 10,
      permissions: [],
      configSchema: {},
      chatInputParams: [],
      frontend: {
        routes: [
          {
            path: "/tools/thumbnail-generator",
            component: "Page",
            title: "Thumbs",
          },
        ],
        components: {},
      },
      backend: { modulePath: "ThumbnailModule", events: [] },
      status: "active",
    });
  });

  it("keeps explicitly provided values", () => {
    const result = ToolDefinition.create(
      input({
        version: "2.1.0",
        icon: "🎨",
        creditsPerUse: 25,
        permissions: [{ resource: "images", actions: ["create"] } as never],
        chatInputParams: [
          {
            name: "prompt",
            type: "string",
            required: true,
            description: "idea",
          },
        ],
        backend: { module: ThumbnailModule, events: ["thumbnail.completed"] },
      }),
    );

    expect(result).toMatchObject({
      version: "2.1.0",
      icon: "🎨",
      creditsPerUse: 25,
      backend: {
        modulePath: "ThumbnailModule",
        events: ["thumbnail.completed"],
      },
    });
    expect(result.chatInputParams).toHaveLength(1);
    expect(result.permissions).toHaveLength(1);
  });

  it("falls back to the tool id when the module has no name", () => {
    const result = ToolDefinition.create(input({ backend: { module: {} } }));
    expect(result.backend.modulePath).toBe("thumbnail-generator");
  });
});

describe("registerTool / loadTools", () => {
  it("builds manifests for every registered tool", async () => {
    vi.resetModules();
    const { registerTool } = await import("../register-tool");
    const { loadTools } = await import("../load-tools");

    registerTool(input());
    registerTool(input({ id: "video", name: "Video", category: "video" }));

    const { manifests, backendModules } = loadTools();

    expect(manifests.map((m) => m.id)).toEqual([
      "thumbnail-generator",
      "video",
    ]);
    expect(backendModules).toEqual([
      { module: ThumbnailModule, toolId: "thumbnail-generator" },
      { module: ThumbnailModule, toolId: "video" },
    ]);
  });

  it("ToolDiscoveryService registers every loaded tool on init", async () => {
    vi.resetModules();
    const { registerTool } = await import("../register-tool");
    const { ToolDiscoveryService } = await import("../tool-discovery.service");
    const { ToolRegistry: FreshRegistry } = await import("../tool-registry");

    registerTool(input());
    const registry = new FreshRegistry();
    new ToolDiscoveryService(registry).onModuleInit();

    expect(registry.get("thumbnail-generator")?.name).toBe(
      "Thumbnail Generator",
    );
  });
});

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(manifest({ id: "thumb", category: "thumbnail" }));
    registry.register(
      manifest({ id: "vid", category: "video", status: "beta" }),
    );
    registry.register(
      manifest({ id: "old", category: "video", status: "deprecated" }),
    );
    registry.register(
      manifest({ id: "off", category: "social", status: "inactive" }),
    );
  });

  it("looks tools up by id", () => {
    expect(registry.get("vid")?.status).toBe("beta");
    expect(registry.get("missing")).toBeUndefined();
  });

  it("treats active and beta tools as available", () => {
    expect(registry.getActive().map((t) => t.id)).toEqual(["thumb", "vid"]);
    expect(registry.getAll()).toHaveLength(4);
  });

  it("filters by category regardless of status", () => {
    expect(registry.getByCategory("video").map((t) => t.id)).toEqual([
      "vid",
      "old",
    ]);
  });

  it("overwrites a tool registered twice and warns", () => {
    const warn = vi.spyOn(console, "log");
    registry.register(manifest({ id: "thumb", name: "Renamed" }));

    expect(registry.getAll()).toHaveLength(4);
    expect(registry.get("thumb")?.name).toBe("Renamed");
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes("overwriting: thumb")),
    ).toBe(true);
  });

  it("unregisters tools", () => {
    registry.unregister("thumb");
    expect(registry.get("thumb")).toBeUndefined();
  });

  it("lists frontend routes and permissions tagged with their tool", () => {
    registry.register(
      manifest({
        id: "perm",
        permissions: [{ resource: "x", actions: ["read"] } as never],
      }),
    );

    expect(registry.getFrontendRoutes()).toContainEqual(
      expect.objectContaining({
        path: "/tools/thumbnail-generator",
        toolId: "thumb",
      }),
    );
    expect(registry.getPermissions()).toEqual([
      { resource: "x", actions: ["read"], toolId: "perm" },
    ]);
  });
});
