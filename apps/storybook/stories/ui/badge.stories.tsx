import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@creator-hub/ui";

const VARIANTS = [
  "default",
  "primary",
  "secondary",
  "accent",
  "error",
  "warning",
  "outline",
  "premium",
  "free",
] as const;

const meta = {
  title: "UI/Data display/Badge",
  component: Badge,
  parameters: {
    docs: {
      description: {
        component:
          "Short status or category label (plan, tier, task type, status). Non-interactive. Colors come from the design tokens (`bg-primary-light text-primary`, …).",
      },
    },
  },
  argTypes: {
    variant: {
      description:
        "Meaning: `secondary` = success/active, `error`, `warning`, `premium`/`free` for plans, `outline` for neutral tags.",
      control: "select",
      options: VARIANTS,
      table: { defaultValue: { summary: "default" } },
    },
    size: {
      description: "`sm` (default) for tables and cards, `md` for headers.",
      control: "inline-radio",
      options: ["sm", "md"],
      table: { defaultValue: { summary: "sm" } },
    },
    children: { description: "Label.", control: "text" },
    className: { description: "Extra classes.", control: "text" },
  },
  args: { children: "Starter", variant: "primary", size: "sm" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllVariants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {VARIANTS.map((variant) => (
        <Badge key={variant} {...args} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Badge {...args} size="sm">
        Small
      </Badge>
      <Badge {...args} size="md">
        Medium
      </Badge>
    </div>
  ),
};
