import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "video-generator",
  name: "Video Generator",
  description: "Generate stunning AI videos with Wan AI models",
  version: "1.0.0",
  icon: "🎬",
  category: "video",
  creditsPerUse: 50,
  permissions: [
    {
      action: "generate",
      resource: "video",
      description: "Generate videos",
    },
    {
      action: "read",
      resource: "video",
      description: "View generated videos",
    },
  ],
  chatInputParams: [
    {
      name: "prompt",
      type: "string",
      required: true,
      description: "video description",
    },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/video-generator",
        component: "VideoGeneratorPage",
        title: "Video Generator",
        icon: "🎬",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "VideoGeneratorModule",
    events: ["video.generated", "video.created"],
  },
});
