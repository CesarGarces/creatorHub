import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "video-clipper",
  name: "AI Video Analyzer & Smart Clipper",
  description:
    "Upload a video (up to 250 MB, processed in your browser), let a multimodal AI find the best moments, hooks and titles, then preview and export short clips straight to your device",
  version: "1.0.0",
  icon: "🎬",
  category: "video",
  // Priced by the selected vision model (Admin → AI Models) × keyframe
  // batches, see backend/src/pricing.ts — not a flat per-use fee.
  creditsPerUse: 0,
  permissions: [
    {
      action: "analyze",
      resource: "video",
      description: "Analyze video keyframes with a multimodal AI model",
    },
    {
      action: "read",
      resource: "video-analysis",
      description: "View past video analyses",
    },
    {
      action: "delete",
      resource: "video-analysis",
      description: "Delete past video analyses",
    },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/video-clipper",
        component: "VideoClipperPage",
        title: "AI Video Analyzer & Smart Clipper",
        icon: "🎬",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "VideoClipperModule",
    // Synchronous tool: the analysis is returned in the HTTP response.
    events: [],
  },
});
