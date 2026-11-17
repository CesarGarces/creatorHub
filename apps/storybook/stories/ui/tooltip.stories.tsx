import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Settings } from "lucide-react";
import { Tooltip } from "@creator-hub/ui";

const meta = {
  title: "UI/Overlays/Tooltip",
  component: Tooltip,
  parameters: {
    docs: {
      description: {
        component:
          "CSS-only hover hint (e.g. labels of the collapsed sidebar). Hover does not exist on touch screens: never put essential information only in a tooltip — the trigger must have its own `aria-label`.",
      },
    },
  },
  argTypes: {
    content: { description: "Hint text.", control: "text" },
    side: {
      description: "Where the hint appears.",
      control: "inline-radio",
      options: ["top", "bottom", "left", "right"],
      table: { defaultValue: { summary: "top" } },
    },
    className: {
      description: "Extra classes for the bubble.",
      control: "text",
    },
    children: {
      description: "The trigger element (needs its own accessible name).",
      control: false,
    },
  },
  args: { content: "Settings", side: "top", children: null },
  render: ({ children: _trigger, ...args }) => (
    <div className="p-12">
      <Tooltip {...args}>
        <button
          type="button"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
        >
          <Settings className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  ),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Top: Story = {};
export const Right: Story = { args: { side: "right" } };
