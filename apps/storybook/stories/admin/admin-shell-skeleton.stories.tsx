import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { AdminShellSkeleton } from "@admin/components/admin-shell-skeleton";
import { withAdminApp } from "../../.storybook/decorators/admin";
import { viewport } from "../../.storybook/viewports";

const meta = {
  title: "Admin/Navigation/AdminShellSkeleton",
  component: AdminShellSkeleton,
  decorators: [withAdminApp],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Server-rendered placeholder of the admin shell, shown by `AuthGuard` while it checks the session (and while redirecting to /login). App name and menu icon paint with the first HTML bytes, and the shell's geometry is reserved (mobile top bar `h-14`, docked sidebar `w-64` from `lg`) so the real `AdminLayout` replaces it without layout shift.",
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
} satisfies Meta<typeof AdminShellSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  globals: viewport("desktop"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading...");
  },
};
export const Mobile: Story = { globals: viewport("mobile") };
