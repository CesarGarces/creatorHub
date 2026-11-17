import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScrollArea } from "@creator-hub/ui";

const meta = {
  title: "UI/Layout/ScrollArea",
  component: ScrollArea,
  parameters: {
    docs: {
      description: {
        component:
          "Scroll container with a styled scrollbar (Radix). Give it a height (`h-72`, `h-[min(520px,65dvh)]`).",
      },
    },
  },
  argTypes: {
    className: {
      description: "Size utilities — a height is required.",
      control: "text",
    },
  },
  args: { className: "h-72 w-64 rounded-xl border border-border bg-surface" },
  render: (args) => (
    <ScrollArea {...args}>
      <ul className="divide-y divide-border">
        {Array.from({ length: 30 }).map((_, i) => (
          <li key={i} className="px-4 py-2.5 text-sm text-text">
            Conversation #{i + 1}
          </li>
        ))}
      </ul>
    </ScrollArea>
  ),
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConversationList: Story = {};
