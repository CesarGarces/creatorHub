import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { RobotinaOrb } from "@/components/voice-assistant/robotina-orb";
import { withWebApp } from "../../../.storybook/decorators/web";

/** A voice-like level: syllables (fast) inside phrases (slow), 0–1. */
const syntheticVoice = () => {
  const t = performance.now() / 1000;
  const phrase = Math.max(0, Math.sin(t * 1.1));
  const syllables = 0.5 + 0.5 * Math.abs(Math.sin(t * 9.5));
  return Math.min(1, phrase * syllables * 0.95);
};

const meta = {
  title: "Web/Voice assistant/RobotinaOrb",
  component: RobotinaOrb,
  decorators: [withWebApp],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Robotina's orb (tool page, live voice bar and dashboard widget): a glowing sphere with particles floating around it. While the user talks (**listening**, cyan) or Robotina talks (**speaking**, magenta) its rim waves with the live audio level and rings spread out on loud syllables; **thinking** swirls violet light inside. Canvas 2D, animated only while on screen and the tab is visible; with reduced motion the particles stand still and the rim only swells. Decorative (`aria-hidden`): the button around it carries the name. These stories feed a synthetic voice level.",
      },
    },
  },
  argTypes: {
    state: {
      description: "Conversation state.",
      control: "inline-radio",
      options: ["idle", "listening", "thinking", "speaking"],
    },
    size: { description: "Width and height in px.", control: "number" },
    getLevel: {
      description: "Live audio level (0–1), read every frame.",
      table: { category: "Audio" },
    },
  },
  args: { state: "idle", size: 200 },
} satisfies Meta<typeof RobotinaOrb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = canvasElement.querySelector("canvas")!;
    await expect(canvas.getAttribute("data-orb-state")).toBe("idle");
    await expect(canvas.getAttribute("aria-hidden")).toBe("true");
    await expect(canvas.style.width).toBe("200px");
  },
};

export const Listening: Story = {
  args: { state: "listening", getLevel: syntheticVoice },
};

export const Thinking: Story = { args: { state: "thinking" } };

export const Speaking: Story = {
  args: { state: "speaking", getLevel: syntheticVoice },
};

/** The compact orb of the live voice bar above the composer. */
export const Compact: Story = {
  args: { state: "speaking", size: 56, getLevel: syntheticVoice },
};

export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      {(["idle", "listening", "thinking", "speaking"] as const).map((state) => (
        <figure key={state} className="flex flex-col items-center gap-2">
          <RobotinaOrb
            state={state}
            size={140}
            getLevel={
              state === "idle" || state === "thinking"
                ? undefined
                : syntheticVoice
            }
          />
          <figcaption className="text-xs text-text-muted">{state}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
