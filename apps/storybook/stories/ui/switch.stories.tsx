import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Switch } from "@creator-hub/ui";

const meta = {
  title: "UI/Forms/Switch",
  component: Switch,
  parameters: {
    docs: {
      description: {
        component:
          'Radix switch (`role="switch"`) for on/off settings that apply immediately (e.g. activating a model). Always give it an accessible name with `aria-label` or a `<label>`.',
      },
    },
  },
  argTypes: {
    checked: { description: "Controlled on/off state.", control: "boolean" },
    disabled: { description: "Disabled state.", control: "boolean" },
    "aria-label": {
      description: "Accessible name (required when there is no visible label).",
      control: "text",
    },
    onCheckedChange: {
      description: "Called with the new state.",
      table: { category: "Events" },
    },
  },
  args: {
    checked: false,
    disabled: false,
    "aria-label": "Activate now",
    onCheckedChange: fn(),
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Controlled: the story keeps the state so clicking toggles it. */
export const Playground: Story = {
  render: function Render(args) {
    const [checked, setChecked] = useState(args.checked ?? false);
    return (
      <label className="flex items-center gap-3 text-sm text-text">
        <Switch
          {...args}
          checked={checked}
          onCheckedChange={(value) => {
            setChecked(value);
            args.onCheckedChange?.(value);
          }}
        />
        Activate now
      </label>
    );
  },
  play: async ({ canvasElement, args }) => {
    const toggle = within(canvasElement).getByRole("switch");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};

export const On: Story = { args: { checked: true } };
export const Disabled: Story = { args: { disabled: true, checked: true } };
