import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoadingSpinner } from "@creator-hub/ui";

const meta = {
  title: "UI/Feedback/LoadingSpinner",
  component: LoadingSpinner,
  parameters: {
    docs: {
      description: {
        component:
          "Animated progress indicator used while a generation runs (thumbnail, video, translation).",
      },
    },
  },
  argTypes: {
    size: {
      description: "Overall size.",
      control: "inline-radio",
      options: ["sm", "md", "lg"],
      table: { defaultValue: { summary: "md" } },
    },
    text: { description: "Label under the animation.", control: "text" },
    colors: { description: "Gradient colors of the glow.", control: "object" },
    speed: {
      description: "Animation speed multiplier.",
      control: { type: "range", min: 0.5, max: 3, step: 0.5 },
    },
  },
  args: {
    size: "md",
    text: "Generating…",
    colors: ["#c084fc", "#f472b6", "#38bdf8"],
  },
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = {
  args: { size: "lg", text: "Translating content…" },
};
