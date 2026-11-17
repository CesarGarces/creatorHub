import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@creator-hub/ui";

interface PopoverArgs {
  align: "start" | "center" | "end";
  side: "top" | "right" | "bottom" | "left";
  sideOffset: number;
  collisionPadding: number;
}

const meta = {
  title: "UI/Overlays/Popover",
  component: PopoverContent,
  subcomponents: { Popover, PopoverTrigger },
  parameters: {
    docs: {
      description: {
        component:
          "Radix popover (notifications panel). Stays on screen on phones: `collisionPadding` (8px) plus `max-w-[calc(100vw-1rem)]` and a max height equal to the room left (`--radix-popover-content-available-height`).",
      },
    },
  },
  argTypes: {
    align: {
      description: "Alignment against the trigger.",
      control: "inline-radio",
      options: ["start", "center", "end"],
    },
    side: {
      description: "Preferred side.",
      control: "inline-radio",
      options: ["top", "right", "bottom", "left"],
    },
    sideOffset: {
      description: "Gap to the trigger in px.",
      control: { type: "number", min: 0 },
    },
    collisionPadding: {
      description: "Minimum distance to the viewport edges.",
      control: { type: "number", min: 0 },
    },
  },
  args: { align: "end", side: "bottom", sideOffset: 4, collisionPadding: 8 },
  render: (args) => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-surface-elevated hover:text-text"
        >
          <Bell className="h-[18px] w-[18px]" />
        </button>
      </PopoverTrigger>
      {/* Radix gives the panel role="dialog": it needs a name. */}
      <PopoverContent
        {...(args as PopoverArgs)}
        aria-label="Notifications"
        className="w-80 p-0"
      >
        <div className="border-b border-border p-3 text-sm font-semibold text-text">
          Notifications
        </div>
        <p className="p-4 text-center text-sm text-text-muted">
          No notifications
        </p>
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<PopoverArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Notifications: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Open notifications" }),
    );
    await expect(await screen.findByText("No notifications")).toBeVisible();
  },
};
