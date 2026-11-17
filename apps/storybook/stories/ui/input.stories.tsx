import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Search } from "lucide-react";
import { Input } from "@creator-hub/ui";

const meta = {
  title: "UI/Forms/Input",
  component: Input,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Text field with an optional label (tied to the field through a generated `id`) and an error message. Accepts every native `<input>` attribute. " +
          "**Utilities:** `focus:ring-1 focus:ring-primary`; on phones and touch devices the global stylesheet renders fields at 16px so iOS never zooms into them.",
      },
    },
  },
  argTypes: {
    label: {
      description:
        "Visible label, linked to the field (`htmlFor`) — also its accessible name.",
      control: "text",
    },
    error: {
      description:
        "Error message shown under the field; also turns the border red.",
      control: "text",
    },
    placeholder: { description: "Hint shown while empty.", control: "text" },
    type: {
      description: "Native input type.",
      control: "select",
      options: [
        "text",
        "email",
        "password",
        "number",
        "search",
        "date",
        "time",
      ],
    },
    disabled: { description: "Native disabled state.", control: "boolean" },
    className: {
      description: "Extra classes for the `<input>` element.",
      control: "text",
    },
    onChange: { description: "Change handler.", table: { category: "Events" } },
  },
  args: {
    label: "Email",
    placeholder: "you@example.com",
    type: "email",
    disabled: false,
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    const field = within(canvasElement).getByLabelText("Email");
    await userEvent.type(field, "ana@example.com");
    await expect(field).toHaveValue("ana@example.com");
    await expect(args.onChange).toHaveBeenCalled();
  },
};

export const WithError: Story = {
  args: { error: "Enter a valid email address", defaultValue: "ana@" },
};

export const Password: Story = {
  args: { label: "Password", type: "password", placeholder: "••••••••" },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "ana@example.com" },
};

/** Icon inside the field, as in the admin search boxes. */
export const WithLeadingIcon: Story = {
  args: {
    label: undefined,
    placeholder: "Search users…",
    className: "pl-10",
    type: "search",
  },
  render: (args) => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
      <Input {...args} aria-label="Search users" />
    </div>
  ),
};
