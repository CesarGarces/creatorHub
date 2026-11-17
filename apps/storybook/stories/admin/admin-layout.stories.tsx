import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AdminLayout } from "@admin/components/admin-layout";
import { withAdminApp } from "../../.storybook/decorators/admin";
import { viewport } from "../../.storybook/viewports";

const meta = {
  title: "Admin/Navigation/AdminLayout",
  component: AdminLayout,
  decorators: [withAdminApp],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/" } },
    docs: {
      description: {
        component:
          "Admin shell. Below `lg` a sticky top bar with the menu button opens the navigation drawer (closed by default; Escape, backdrop or navigating closes it). From `lg` the sidebar is docked and the content is offset by `lg:pl-64`. Content padding: `p-4 sm:p-6 lg:p-8`.",
      },
      story: { inline: false, iframeHeight: 640 },
    },
  },
  argTypes: {
    children: { description: "The admin page.", control: false },
  },
  args: {
    children: (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-text sm:text-2xl">Dashboard</h1>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            "Total Users",
            "Active Users",
            "Credits Used",
            "Total Favorites",
          ].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-surface p-4 text-sm text-text-muted sm:p-6"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
  },
} satisfies Meta<typeof AdminLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Tablet: Story = { globals: viewport("tablet") };

export const Mobile: Story = {
  globals: viewport("mobile"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The menu button only exists below lg (docked sidebar from lg).
    const menu = canvas.queryByRole("button", { name: "Open menu" });
    if (!menu || window.innerWidth >= 1024) return;
    await userEvent.click(menu);
    await expect(
      canvas.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  },
};
