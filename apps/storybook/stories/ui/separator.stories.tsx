import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Separator } from "@creator-hub/ui";

const meta = {
  title: "UI/Layout/Separator",
  component: Separator,
  parameters: {
    docs: {
      description: {
        component:
          "Thin divider (Radix). Decorative by default; set `decorative={false}` when it separates meaningful groups for screen readers.",
      },
    },
  },
  argTypes: {
    orientation: {
      description: "Direction of the line.",
      control: "inline-radio",
      options: ["horizontal", "vertical"],
      table: { defaultValue: { summary: "horizontal" } },
    },
    decorative: {
      description: "Hidden from assistive technology when true.",
      control: "boolean",
    },
  },
  args: { orientation: "horizontal", decorative: true },
  render: (args) =>
    args.orientation === "vertical" ? (
      <div className="flex h-6 items-center gap-3 text-sm text-text-muted">
        Week
        <Separator {...args} />
        Month
        <Separator {...args} />
        Agenda
      </div>
    ) : (
      <div className="w-64 space-y-3 text-sm text-text-muted">
        <p>Profile</p>
        <Separator {...args} />
        <p>Danger zone</p>
      </div>
    ),
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};
export const Vertical: Story = { args: { orientation: "vertical" } };
