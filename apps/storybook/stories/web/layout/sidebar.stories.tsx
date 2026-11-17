import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Sidebar } from "@/components/layout/sidebar";
import { seedWebSession, withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/Navigation/Sidebar",
  component: Sidebar,
  decorators: [
    withWebApp,
    (Story) => (
      <div className="flex h-dvh bg-bg">
        <Story />
        <main className="flex-1 p-6 text-sm text-text-muted">Page content</main>
      </div>
    ),
  ],
  beforeEach: () => seedWebSession(),
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/tools/content-planner" },
    },
    docs: {
      description: {
        component:
          'Main navigation. From `lg` (1024px) it is docked and collapsible to icons; below `lg` the same `<aside id="app-sidebar">` is an off-canvas drawer, **closed by default**, opened from the top bar (state: `useMobileNavStore`). ' +
          'The drawer closes after navigating, on backdrop tap and on Escape; it moves focus in and back to the menu button. The active route is the most specific match (`aria-current="page"`).',
      },
      story: { inline: false, iframeHeight: 640 },
    },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Docked (lg+). The collapse button switches to icons only. */
export const Docked: Story = { globals: viewport("desktop") };

/** Below lg the drawer starts closed: the page gets the full width. */
export const DrawerClosedOnMobile: Story = { globals: viewport("mobile") };

export const DrawerOpenOnMobile: Story = {
  beforeEach: () => seedWebSession({ drawerOpen: true }),
  globals: viewport("mobile"),
};

export const DrawerOpenOnTablet: Story = {
  beforeEach: () => seedWebSession({ drawerOpen: true }),
  globals: viewport("tablet"),
};
