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
          "Dashboard widget **Robotina**: the AI voice assistant. Tap the orb and talk — voice input uses the platform's Deepgram STT (priced per second in Admin → Voice, like every voice button); she answers out loud with Deepgram voices in the language you speak, with the voice the admin set for it (by default Andromeda/English, Celeste/Spanish, Bianca/Portuguese) — 1 credit per written reply, spoken replies by the second. While you speak the orb waves with your voice, while she speaks with hers. A second tap sends at once; tapping while she talks interrupts her. **Conversation mode** listens again after each answer (it stops after 8 s of silence). “Open chat” continues the same conversation in the tool. When she acts for you (e.g. “schedule a recording tomorrow from 3 to 4”) the session appears as a compact card linking to the planner. Loads no data until tapped.",
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

/** She just put a session in the calendar: a compact card under her words. */
export const AfterSchedulingAPlan: Story = {
  beforeEach: () => {
    seedWebSession();
    useVoiceAssistantStore.setState({
      activeConversationId: "c1",
      isReplying: false,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Agenda grabar el unboxing mañana de 3 a 4 de la tarde",
          spoken: true,
          audioMs: 0,
          credits: 0,
          interrupted: false,
        },
        {
          id: "m2",
          role: "assistant",
          content: "¡Listo! Quedó para mañana de tres a cuatro de la tarde.",
          spoken: true,
          language: "es",
          audioMs: 3100,
          credits: 1,
          interrupted: false,
          actions: [
            {
              id: "a1",
              name: "calendar.create_event",
              args: {},
              status: "done",
              data: {
                kind: "calendar-event",
                change: "created",
                event: {
                  id: "ev1",
                  title: "Grabar el unboxing",
                  type: "RECORDING",
                  startAt: "2026-11-28T20:00:00.000Z",
                  endAt: "2026-11-28T21:00:00.000Z",
                },
                conflicts: [],
                url: "/tools/content-planner?date=2026-11-28T20%3A00%3A00.000Z",
              },
            },
          ],
        },
      ],
    });
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: /Grabar el unboxing/ }),
    ).toBeVisible();
  },
};

export const Phone: Story = { globals: viewport("mobileSmall") };
