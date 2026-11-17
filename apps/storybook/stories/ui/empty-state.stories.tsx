import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { EmptyState } from "@creator-hub/ui";

const meta = {
  title: "UI/Feedback/EmptyState",
  component: EmptyState,
  parameters: {
    docs: {
      description: {
        component:
          "Placeholder for empty lists with an optional call to action.",
      },
    },
  },
  argTypes: {
    icon: { description: "Emoji shown above the title.", control: "text" },
    title: { description: "What is empty.", control: "text" },
    description: { description: "What to do about it.", control: "text" },
    actionLabel: {
      description: "Button label (needs `onAction`).",
      control: "text",
    },
    onAction: { description: "Button handler.", table: { category: "Events" } },
  },
  args: {
    icon: "📁",
    title: "No assets yet",
    description: "Generate your first thumbnail and it will appear here.",
    actionLabel: "Create your first thumbnail",
    onAction: fn(),
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {};
export const WithoutAction: Story = {
  args: { actionLabel: undefined, onAction: undefined },
};
