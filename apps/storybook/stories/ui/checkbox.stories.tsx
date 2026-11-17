import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Checkbox } from "@creator-hub/ui";

const meta = {
  title: "UI/Forms/Checkbox",
  component: Checkbox,
  parameters: {
    docs: {
      description: {
        component:
          'Radix checkbox (`role="checkbox"`). Controlled with `checked` + `onCheckedChange` or uncontrolled with `defaultChecked`; `checked="indeterminate"` for partial selections.',
      },
    },
  },
  argTypes: {
    checked: {
      description: 'Controlled state: `true`, `false` or `"indeterminate"`.',
      control: "select",
      options: [true, false, "indeterminate"],
    },
    disabled: { description: "Disabled state.", control: "boolean" },
    onCheckedChange: {
      description: "Called with the new state.",
      table: { category: "Events" },
    },
  },
  args: { disabled: false, onCheckedChange: fn() },
  render: (args) => (
    <label className="flex items-center gap-2 text-sm text-text">
      <Checkbox {...args} />
      Remember my choice
    </label>
  ),
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("checkbox"));
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};

export const Checked: Story = { args: { checked: true } };
export const Indeterminate: Story = { args: { checked: "indeterminate" } };
export const Disabled: Story = { args: { disabled: true, checked: true } };
