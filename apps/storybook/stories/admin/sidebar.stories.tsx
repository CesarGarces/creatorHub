import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Sidebar } from "@admin/components/sidebar";
import { withAdminApp } from "../../.storybook/decorators/admin";
import { viewport } from "../../.storybook/viewports";

const meta = {
  title: "Admin/Navigation/Sidebar",
  component: Sidebar,
  decorators: [withAdminApp],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/models" } },
    docs: {
      description: {
        component:
          "Admin navigation. Docked (256px) from `lg`; below `lg` it is a drawer controlled by `AdminLayout` through `mobileOpen`/`onMobileClose` (closed by default). Links are 44px tall; the language switcher and logout sit in the footer.",
      },
      story: { inline: false, iframeHeight: 640 },
    },
  },
  argTypes: {
    mobileOpen: {
      description: "Drawer open below `lg` (ignored when docked).",
      control: "boolean",
      table: { defaultValue: { summary: "false" } },
    },
    onMobileClose: {
      description: "Close button or a link tapped in the drawer.",
      table: { category: "Events" },
    },
  },
  args: { mobileOpen: false, onMobileClose: fn() },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Docked: Story = { globals: viewport("desktop") };
export const DrawerOpenOnMobile: Story = {
  args: { mobileOpen: true },
  globals: viewport("mobile"),
};
