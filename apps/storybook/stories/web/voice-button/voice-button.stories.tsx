import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { VoiceButton } from "@/components/voice-button/voice-button";
import { withWebApp } from "../../../.storybook/decorators/web";

const meta = {
  title: "Web/Forms/VoiceButton",
  component: VoiceButton,
  decorators: [withWebApp],
  parameters: {
    docs: {
      description: {
        component:
          "Microphone toggle for speech-to-text (chat, translator, script writer). Recording state is shown with color and pulse; optionally the credit rate per second (Admin → Voice).",
      },
    },
  },
  argTypes: {
    variant: {
      description: "`icon` (square) or `icon-text` (with label).",
      control: "inline-radio",
      options: ["icon", "icon-text"],
    },
    isListening: { description: "Recording in progress.", control: "boolean" },
    isSupported: {
      description: "Browser supports voice input (hidden when false).",
      control: "boolean",
    },
    disabled: { description: "Disabled state.", control: "boolean" },
    label: { description: "Label while idle (`icon-text`).", control: "text" },
    listeningLabel: {
      description: "Label while recording (`icon-text`).",
      control: "text",
    },
    showCredits: {
      description: "Show the credit rate while recording.",
      control: "boolean",
    },
    className: {
      description: "Extra classes (e.g. `h-10 w-10`).",
      control: "text",
    },
    onToggle: {
      description: "Start/stop pressed.",
      table: { category: "Events" },
    },
  },
  args: {
    variant: "icon-text",
    isListening: false,
    isSupported: true,
    disabled: false,
    showCredits: false,
    onToggle: fn(),
  },
} satisfies Meta<typeof VoiceButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
export const Listening: Story = { args: { isListening: true } };
export const IconOnly: Story = { args: { variant: "icon" } };
