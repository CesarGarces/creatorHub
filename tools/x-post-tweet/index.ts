import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "x-post-tweet",
  name: "Post to X",
  description:
    "Publish a tweet to your connected X (Twitter) account. Supports text tweets and threads.",
  version: "1.0.0",
  icon: "💬",
  category: "social",
  creditsPerUse: 5,
  permissions: [
    {
      action: "publish",
      resource: "x-tweet",
      description: "Publish tweets",
    },
    {
      action: "read",
      resource: "x-tweet",
      description: "View published tweets",
    },
  ],
  chatInputParams: [
    {
      name: "text",
      type: "string",
      required: true,
      description: "what the user wants to tweet about",
      maxLength: 280,
    },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/x-post-tweet",
        component: "XPostTweetPage",
        title: "Post to X",
        icon: "💬",
        showInNav: false,
      },
    ],
  },
  backend: {
    module: "XPostTweetModule",
    events: ["x.tweet.published", "x.tweet.failed"],
  },
});
