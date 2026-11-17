import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ChatLauncher } from "@/components/chat/chat-launcher";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/Chat/ChatLauncher",
  component: ChatLauncher,
  decorators: [
    withWebApp,
    (Story) => (
      <div className="min-h-[420px] p-6 text-sm text-text-muted">
        <p>Page content. The launcher floats in the bottom-right corner.</p>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Floating assistant button. Expanded on load (with a short-lived hint), then after 5 s without interaction — or as soon as the page scrolls — it tucks into a 44px tab against the screen edge. Hover, keyboard focus or a first tap bring the full button back; a click (or second tap) opens the chat. Only the inner pill moves (translate/radius/colours) inside a fixed slot: no layout shift, and the slot lets taps through to the content beside the tab.",
      },
    },
  },
  argTypes: {
    onOpen: {
      description: "The chat should open.",
      table: { category: "Events" },
    },
    collapseAfterMs: {
      description: "Idle time before collapsing (ms, default 5000).",
      control: "number",
    },
    hideTooltip: {
      description: "Never show the “Do you need help?” hint.",
      control: "boolean",
    },
  },
  args: { onOpen: fn(), collapseAfterMs: 600_000, hideTooltip: false },
} satisfies Meta<typeof ChatLauncher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};
export const Collapsed: Story = {
  args: { collapseAfterMs: 1, hideTooltip: true },
};
export const AutoCollapse: Story = {
  name: "Auto-collapse (5 s)",
  args: { collapseAfterMs: 5000 },
};
export const MobileCollapsed: Story = {
  args: { collapseAfterMs: 1, hideTooltip: true },
  globals: viewport("mobile"),
};
