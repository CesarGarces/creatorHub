import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "content-translator",
  name: "Content Translator",
  description: "Translate content across multiple languages with AI precision",
  version: "1.0.0",
  icon: "\uD83C\uDF10",
  category: "translator",
  creditsPerUse: 1,
  permissions: [
    {
      action: "translate",
      resource: "content",
      description: "Translate text content between languages",
    },
    {
      action: "read",
      resource: "translation",
      description: "View translation history",
    },
  ],
  chatInputParams: [
    {
      name: "prompt",
      type: "string",
      required: true,
      description: "text to translate",
    },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/content-translator",
        component: "ContentTranslatorPage",
        title: "Content Translator",
        icon: "\uD83C\uDF10",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "ContentTranslatorModule" as any,
    events: ["translation.completed", "translation.failed"],
  },
});
