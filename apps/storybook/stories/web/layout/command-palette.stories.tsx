import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { CommandPalette } from "@/components/layout/command-palette";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/Navigation/CommandPalette",
  component: CommandPalette,
  decorators: [withWebApp],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "⌘K / Ctrl+K palette of the dashboard (tools, agents, pages). The search field is focused on open; selecting an item navigates (`router.push`) or runs its `action`, then closes.",
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
  argTypes: {
    isOpen: { description: "Controlled visibility.", control: "boolean" },
    items: {
      description:
        "Custom commands (default: the app's tools, agents and pages).",
      control: "object",
    },
    onClose: {
      description: "Escape, backdrop or after selecting.",
      table: { category: "Events" },
    },
  },
  args: { isOpen: true, onClose: fn() },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Mobile: Story = { globals: viewport("mobile") };
