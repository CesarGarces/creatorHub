import { registerTool } from "@creator-hub/tool-sdk";

registerTool({
  id: "voice-assistant",
  name: "Robotina — AI Voice Assistant",
  description:
    "Talk with Robotina about any topic with fluid, real-time voice: speak in English, Spanish or Portuguese and she answers out loud in your language",
  version: "1.0.0",
  icon: "🤖",
  category: "assistant",
  // Priced per reply, not per use: 1 credit per written reply; spoken ones
  // cost their seconds of speech (Admin → Voice). Voice input is billed by
  // the STT gateway, per second.
  creditsPerUse: 1,
  permissions: [
    {
      action: "chat",
      resource: "voice-assistant",
      description: "Talk with Robotina (voice or text)",
    },
    {
      action: "read",
      resource: "voice-conversation",
      description: "View past conversations",
    },
    {
      action: "delete",
      resource: "voice-conversation",
      description: "Delete past conversations",
    },
  ],
  chatInputParams: [
    {
      name: "prompt",
      type: "string",
      required: false,
      description: "what the user wants to talk about with Robotina",
      maxLength: 4000,
    },
  ],
  frontend: {
    routes: [
      {
        path: "/tools/voice-assistant",
        component: "VoiceAssistantPage",
        title: "Robotina",
        icon: "🤖",
        showInNav: true,
      },
    ],
  },
  backend: {
    module: "VoiceAssistantModule",
    // Synchronous tool: the reply is streamed in the HTTP response (SSE).
    events: [],
  },
});
