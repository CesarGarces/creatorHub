import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { VoiceAssistantWidget } from "@/components/dashboard-widgets/widgets/voice-assistant-widget";
import { useVoiceAssistantStore } from "@/store/voice-assistant.store";
import {
  seedWebSession,
  withWebApp,
} from "../../../../.storybook/decorators/web";
import { viewport } from "../../../../.storybook/viewports";

function seedConversation(withReply: boolean) {
  useVoiceAssistantStore.setState({
    activeConversationId: withReply ? "c1" : null,
    isReplying: false,
    messages: withReply
      ? [
          {
            id: "m1",
            role: "user",
            content: "¿Qué opinas de grabar en exteriores?",
            spoken: true,
            audioMs: 0,
            credits: 0,
            interrupted: false,
          },
          {
            id: "m2",
            role: "assistant",
            content:
              "¡Me encanta la idea! La luz natural da un look muy cálido. ¿Tienes pensado a qué hora grabar?",
            spoken: true,
            language: "es",
            audioMs: 6200,
            credits: 1,
            interrupted: false,
          },
        ]
      : [],
  });
}

const meta = {
  title: "Web/Dashboard/Widgets/VoiceAssistantWidget",
  component: VoiceAssistantWidget,
  decorators: [
    (Story) => (
      // A half-width dashboard cell.
      <div className="w-[32rem] max-w-full">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  beforeEach: () => {
    seedWebSession();
    seedConversation(false);
  },
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Dashboard widget **Robotina**: the AI voice assistant. Tap the orb and talk — voice input uses the platform's Deepgram STT (1 credit per minute, like every voice button); she answers out loud with Deepgram Aura-2 in the language you speak (Andromeda/English, Celeste/Spanish, Bianca/Portuguese), 1 credit per reply (per started minute of speech). While you speak the orb waves with your voice, while she speaks with hers. A second tap sends at once; tapping while she talks interrupts her. **Conversation mode** listens again after each answer (it stops after 8 s of silence). “Open chat” continues the same conversation in the tool. Loads no data until tapped.",
      },
    },
  },
} satisfies Meta<typeof VoiceAssistantWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Talk to Robotina" }),
    ).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Tap to talk");
    await expect(
      canvas.getByRole("switch", { name: "Conversation mode" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Open chat" }),
    ).toHaveAttribute("href", "/tools/voice-assistant");
  },
};

/** After a talk: her last answer under the orb. */
export const WithLastReply: Story = {
  beforeEach: () => {
    seedWebSession();
    seedConversation(true);
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Me encanta la idea/),
    ).toBeVisible();
  },
};

export const Phone: Story = { globals: viewport("mobileSmall") };
