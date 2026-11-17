import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@creator-hub/ui";

const VARIANTS = [
  "primary",
  "secondary",
  "ghost",
  "danger",
  "outline",
  "glow",
  "link",
] as const;

const meta = {
  title: "UI/Actions/Button",
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          "The action primitive (CVA variants). Renders a native `<button>`, so every button attribute (`type`, `disabled`, `aria-*`, `onClick`…) is supported. " +
          "**Utilities:** `active:scale-[0.98]` press feedback, focus ring via `focus-visible:ring-primary`. " +
          "On touch screens pages add `pointer-coarse:h-11` for 44px targets (see *Foundations/Responsive*).",
      },
    },
  },
  argTypes: {
    variant: {
      description:
        "Visual style. `danger` for destructive actions, `glow` for the main call to action of a screen.",
      control: "select",
      options: VARIANTS,
      table: { defaultValue: { summary: "primary" } },
    },
    size: {
      description:
        "Height and padding: `sm` 32px · `md` 40px · `lg` 48px · `icon` square 40px (icon-only, needs an `aria-label`).",
      control: "inline-radio",
      options: ["sm", "md", "lg", "icon"],
      table: { defaultValue: { summary: "md" } },
    },
    isLoading: {
      description:
        "Shows a spinner and disables the button while an action runs.",
      control: "boolean",
    },
    disabled: { description: "Native disabled state.", control: "boolean" },
    children: { description: "Label and/or icon.", control: "text" },
    className: {
      description:
        "Extra Tailwind classes, merged with `tailwind-merge` (later classes win).",
      control: "text",
    },
    onClick: { description: "Click handler.", table: { category: "Events" } },
  },
  args: {
    children: "Generate",
    variant: "primary",
    size: "md",
    isLoading: false,
    disabled: false,
    onClick: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Use the controls to try every prop. */
export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
    await expect(args.onClick).toHaveBeenCalled();
  },
};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {VARIANTS.map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
      <Button {...args} size="icon" aria-label="Add">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    variant: "danger",
    children: (
      <>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </>
    ),
  },
};

export const Loading: Story = {
  args: { isLoading: true, children: "Generating…", variant: "glow" },
};

export const Disabled: Story = { args: { disabled: true } };

/**
 * Mobile pattern used across the apps: full width on phones, inline from
 * `sm`, and 44px tall on touch screens (`pointer-coarse:h-11`).
 */
export const FullWidthOnPhones: Story = {
  args: {
    className: "w-full sm:w-auto pointer-coarse:h-11",
    children: "Buy credits",
  },
  parameters: { layout: "padded" },
};
