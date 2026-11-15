import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "content-planner",
  name: "Content Planner",
  description:
    "Plan your videos on a calendar: schedule ideation, scripting, recording, editing and publishing sessions, and keep every production on track",
  version: "1.0.0",
  icon: "🗓️",
  category: "planning",
  // Planning is free: no AI calls, no credits.
  creditsPerUse: 0,
  permissions: [
    {
      action: "read",
      resource: "content-plan",
      description: "View planned sessions and video projects",
    },
    {
      action: "write",
      resource: "content-plan",
      description: "Create, reschedule and delete sessions and projects",
    },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/content-planner",
        component: "ContentPlannerPage",
        title: "Content Planner",
        icon: "🗓️",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "ContentPlannerModule",
    events: [],
  },
});
