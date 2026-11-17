import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@creator-hub/ui";
import { viewport } from "../../.storybook/viewports";

interface ModalArgs {
  /** Title of the dialog — also its accessible name. */
  title: string;
  /** Supporting text under the title. */
  description: string;
  /** Show the close (×) button; needs `onClose`. */
  withCloseButton: boolean;
  /** Tailwind max-width of the panel. */
  size: "max-w-sm" | "max-w-md" | "max-w-lg" | "max-w-3xl";
  onClose: () => void;
  onConfirm: () => void;
}

function ModalDemo({
  title,
  description,
  withCloseButton,
  size,
  onClose,
  onConfirm,
}: ModalArgs) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClose();
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>Buy Credits</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={size}
          onClose={withCloseButton ? close : undefined}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4 sm:px-6">
            <Input
              label="Amount in US dollars"
              type="number"
              defaultValue={10}
              min={10}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              Pay $10.00
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const meta = {
  title: "UI/Overlays/Dialog (Modal)",
  component: DialogContent,
  subcomponents: {
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Modal dialog rendered in a portal. `DialogContent` has `role="dialog"` + `aria-modal`, is named by its `DialogTitle`, closes on Escape/backdrop when given `onClose`, and locks page scroll. ' +
          "**Responsive:** the panel never exceeds the *visible* viewport (`h-[var(--app-vvh,100dvh)]` + `max-h-full overflow-y-auto`), so with the on-screen keyboard open it scrolls instead of running off-screen; `DialogFooter` stacks full-width buttons on phones and makes them 44px on touch screens.",
      },
    },
  },
  argTypes: {
    title: {
      description: "Title — also the dialog's accessible name.",
      control: "text",
    },
    description: { description: "Supporting text.", control: "text" },
    withCloseButton: {
      description: "Show the × button (pass `onClose`).",
      control: "boolean",
    },
    size: {
      description: "Max width of the panel (consumer `className`).",
      control: "inline-radio",
      options: ["max-w-sm", "max-w-md", "max-w-lg", "max-w-3xl"],
    },
    onClose: {
      description: "Escape, backdrop or × pressed.",
      table: { category: "Events" },
    },
    onConfirm: {
      description: "Primary action.",
      table: { category: "Events" },
    },
  },
  args: {
    title: "Buy Credits",
    description:
      "Enter the amount in dollars (minimum $10). Credits are calculated based on the Pay as you go plan rate.",
    withCloseButton: true,
    size: "max-w-md",
    onClose: fn(),
    onConfirm: fn(),
  },
  render: (args) => <ModalDemo {...(args as unknown as ModalArgs)} />,
} satisfies Meta<ModalArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click the button to open; Escape or the backdrop closes it. */
export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Buy Credits" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Buy Credits" });
    await expect(dialog).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalled();
  },
};

/** Phones: stacked, full-width footer buttons inside a 12px margin. */
export const OnMobile: Story = {
  globals: viewport("mobile"),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Buy Credits" }),
    );
    await expect(await screen.findByRole("dialog")).toBeVisible();
  },
};

export const Wide: Story = {
  args: { size: "max-w-3xl", title: "Terms of Service" },
};
