import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from "@creator-hub/ui";

interface AlertArgs {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant: "primary" | "danger";
  onConfirm: () => void;
}

const meta = {
  title: "UI/Overlays/AlertDialog",
  component: AlertDialogContent,
  subcomponents: {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Radix alert dialog for confirmations that need an explicit answer (no backdrop dismissal). Focus is trapped and returns to the trigger. Sized to the visible viewport (`max-h-[calc(var(--app-vvh,100dvh)-1.5rem)]`).",
      },
    },
  },
  argTypes: {
    title: { description: "Question being asked.", control: "text" },
    description: {
      description: "Consequences of confirming.",
      control: "text",
    },
    confirmLabel: {
      description: "Label of the action button.",
      control: "text",
    },
    confirmVariant: {
      description:
        "Button variant of the action (`danger` for destructive ones).",
      control: "inline-radio",
      options: ["primary", "danger"],
    },
    onConfirm: {
      description: "Action confirmed.",
      table: { category: "Events" },
    },
  },
  args: {
    title: "Delete this asset?",
    description:
      "The image is removed from your library and its share link stops working.",
    confirmLabel: "Delete",
    confirmVariant: "danger",
    onConfirm: fn(),
  },
  render: (args) => {
    const a = args as unknown as AlertArgs;
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="danger">Delete asset</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{a.title}</AlertDialogTitle>
            <AlertDialogDescription>{a.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant={a.confirmVariant} onClick={a.onConfirm}>
              {a.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
} satisfies Meta<AlertArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Destructive: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Delete asset" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete" }),
    );
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const Confirmation: Story = {
  args: {
    title: "Publish to X?",
    description: "The tweet is posted to your connected account right away.",
    confirmLabel: "Publish",
    confirmVariant: "primary",
  },
};
