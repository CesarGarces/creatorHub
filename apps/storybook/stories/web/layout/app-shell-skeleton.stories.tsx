import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/Navigation/AppShellSkeleton",
  component: AppShellSkeleton,
  decorators: [withWebApp],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'Server-rendered placeholder of the signed-in app shell, shown by the `(authed)` layout until the session is restored on the client. It paints with the first HTML bytes (logo on desktop, menu icon on phones — so the first contentful paint does not wait for JavaScript) and reserves the shell\'s geometry (top bar `h-14`, docked sidebar `w-60` from `lg`), so nothing jumps when `DashboardLayout` takes over. Announced as a busy `status` ("Loading..."). No user data.',
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
} satisfies Meta<typeof AppShellSkeleton>;

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
