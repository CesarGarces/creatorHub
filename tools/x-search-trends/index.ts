import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "x-search-trends",
  name: "X Trend Research",
  description:
    "Search and analyze trending topics on X (Twitter). Returns tweets, engagement metrics, and sentiment analysis.",
  version: "1.0.0",
  icon: "📡",
  category: "social",
  creditsPerUse: 15,
  permissions: [
    {
      action: "search",
      resource: "x-trends",
      description: "Search X trends",
    },
    {
      action: "read",
      resource: "x-trends",
      description: "View search results",
    },
  ],
  chatInputParams: [
    {
      name: "prompt",
      type: "string",
      required: true,
      description: "what the user wants to research",
    },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/x-search-trends",
        component: "XSearchTrendsPage",
        title: "X Trend Research",
        icon: "📡",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "XSearchTrendsModule",
    events: ["x.search.completed", "x.search.failed"],
  },
});
