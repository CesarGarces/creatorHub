import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { Trash2, UserCheck } from "lucide-react";
import { ActionConfirmDialog, Button } from "@creator-hub/ui";
import { viewport } from "../../.storybook/viewports";

const meta = {
  title: "UI/Overlays/ActionConfirmDialog",
  component: ActionConfirmDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Controlled confirmation with custom labels and an optional icon (admin: delete model, (de)activate user…). Escape and the backdrop call `onClose`. " +
          "**Responsive:** keeps a margin on phones, never outgrows the visible viewport, and its buttons become full-width, thumb-sized (`pointer-coarse:h-11`) on small screens.",
      },
    },
  },
  argTypes: {
    isOpen: { description: "Controlled visibility.", control: "boolean" },
    title: {
      description: "Heading (defaults to the localized “Confirm action”).",
      control: "text",
    },
    description: {
      description: "Explanation of the consequences.",
      control: "text",
    },
    confirmLabel: { description: "Confirm button label.", control: "text" },
    cancelLabel: { description: "Cancel button label.", control: "text" },
    confirmVariant: {
      description: "Button variant of the confirm action.",
      control: "select",
      options: ["primary", "secondary", "danger", "outline"],
      table: { defaultValue: { summary: "danger" } },
    },
    isLoading: {
      description: "Spinner + disabled buttons while confirming.",
      control: "boolean",
    },
    icon: {
      description: "Icon node shown in a tinted circle.",
      control: false,
    },
    onConfirm: {
      description: "Confirm pressed.",
      table: { category: "Events" },
    },
    onClose: {
      description: "Cancel, Escape or backdrop.",
      table: { category: "Events" },
    },
  },
  args: {
    isOpen: false,
    title: "Delete model",
    description:
      "Delete “FLUX.1 schnell”? It stops being available immediately.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    confirmVariant: "danger",
    isLoading: false,
    icon: <Trash2 className="h-5 w-5" />,
    onConfirm: fn(),
    onClose: fn(),
  },
  render: function Render(args) {
    const [open, setOpen] = useState(args.isOpen);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open confirmation
        </Button>
        <ActionConfirmDialog
          {...args}
          isOpen={open}
          onClose={() => {
            setOpen(false);
            args.onClose();
          }}
          onConfirm={() => {
            args.onConfirm();
            setOpen(false);
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof ActionConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Delete: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Open confirmation" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete" }),
    );
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const Activate: Story = {
  args: {
    title: "Activate user",
    description: "Ana Creator will be able to sign in again.",
    confirmLabel: "Activate",
    confirmVariant: "primary",
    icon: <UserCheck className="h-5 w-5" />,
  },
};

export const Loading: Story = { args: { isOpen: true, isLoading: true } };

export const OnSmallPhone: Story = {
  args: { isOpen: true },
  globals: viewport("mobileSmall"),
};
