import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "thumbnail-generator",
  name: "Thumbnail Generator",
  description: "Generate stunning YouTube thumbnails with AI",
  version: "1.0.0",
  icon: "🎨",
  category: "ai-image",
  creditsPerUse: 10,
  permissions: [
    { action: "generate", resource: "thumbnail", description: "Generate thumbnails" },
    { action: "read", resource: "thumbnail", description: "View generated thumbnails" },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/thumbnail-generator",
        component: "ThumbnailGeneratorPage",
        title: "Thumbnail Generator",
        icon: "🎨",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "./backend/src/thumbnail-generator.module",
    events: ["image.generated", "thumbnail.created"],
  },
});
