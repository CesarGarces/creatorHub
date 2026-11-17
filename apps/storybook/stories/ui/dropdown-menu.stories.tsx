import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { Copy, Pencil, Trash2 } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@creator-hub/ui";

interface MenuArgs {
  align: "start" | "center" | "end";
  onAction: (action: string) => void;
}

const meta = {
  title: "UI/Overlays/DropdownMenu",
  component: DropdownMenuContent,
  subcomponents: {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Radix menu with keyboard navigation (arrows, Enter, Escape). Items are 44px tall on touch screens (`pointer-coarse:min-h-11`) and the menu is capped to the viewport.",
      },
    },
  },
  argTypes: {
    align: {
      description: "Alignment against the trigger.",
      control: "inline-radio",
      options: ["start", "center", "end"],
    },
    onAction: {
      description: "Item chosen (receives its id).",
      table: { category: "Events" },
    },
  },
  args: { align: "start", onAction: fn() },
  render: (args) => {
    const a = args as unknown as MenuArgs;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={a.align} className="w-48">
          <DropdownMenuLabel>Script</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => a.onAction("edit")}>
            <Pencil className="h-4 w-4" /> Edit
            <DropdownMenuShortcut>E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => a.onAction("copy")}>
            <Copy className="h-4 w-4" /> Copy
            <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-error"
            onSelect={() => a.onAction("delete")}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
} satisfies Meta<MenuArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Actions: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Actions" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Copy/ }),
    );
    await expect(args.onAction).toHaveBeenCalledWith("copy");
  },
};
