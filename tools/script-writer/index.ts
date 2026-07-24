import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "script-writer",
  name: "Script Writer",
  description:
    "Generate structured video scripts with hooks, development, climax, CTA, visual cues, and thumbnail prompts for YouTube, TikTok, Reels, and Shorts",
  version: "1.0.0",
  icon: "📓",
  category: "writing",
  creditsPerUse: 0,
  permissions: [
    {
      action: "generate",
      resource: "script",
      description: "Generate video scripts",
    },
    {
      action: "read",
      resource: "script",
      description: "View script history",
    },
    {
      action: "delete",
      resource: "script",
      description: "Delete generated scripts",
    },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/script-writer",
        component: "ScriptWriterPage",
        title: "Script Writer",
        icon: "📓",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "ScriptWriterModule",
    events: ["script.generated", "script.failed"],
  },
});
