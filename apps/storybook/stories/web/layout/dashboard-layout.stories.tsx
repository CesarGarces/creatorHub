import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TopBar } from "@/components/layout/top-bar";
import { useChatStore } from "@/store/chat.store";
import { seedWebSession, withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

function PageContent() {
  return (
    <>
      <TopBar breadcrumbs={[{ label: "Dashboard" }]} />
      <div className="space-y-4 p-4 sm:p-6">
        <h1 className="text-xl font-bold text-text sm:text-2xl">
          Good afternoon, Ana 👋
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Thumbnail Generator",
            "Video Generator",
            "Script Writer",
            "Content Planner",
          ].map((name) => (
            <div
              key={name}
              className="rounded-xl border border-border bg-surface p-5 text-sm font-semibold text-text"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const meta = {
  title: "Web/Navigation/DashboardLayout (app shell)",
  component: DashboardLayout,
  decorators: [withWebApp],
  beforeEach: () => {
    seedWebSession();
    useChatStore.setState({ isWidgetOpen: false });
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
    docs: {
      description: {
        component:
          "Signed-in shell: sidebar/drawer + backdrop, the scrolling `<main>` and the AI chat (floating button + panel). Uses `h-dvh` so it follows the browser UI and the on-screen keyboard. " +
          "On phones `<main>` keeps bottom room so the chat button never covers content; pages with a bottom composer mark it `data-composer` and the button floats above it.",
      },
      story: { inline: false, iframeHeight: 700 },
    },
  },
  args: { children: <PageContent /> },
  argTypes: {
    children: {
      description: "The page rendered inside `<main>`.",
      control: false,
    },
  },
} satisfies Meta<typeof DashboardLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const TabletLandscape: Story = { globals: viewport("tabletLandscape") };
export const Tablet: Story = { globals: viewport("tablet") };

/** Tap the menu button: the drawer slides in over the page. */
export const Mobile: Story = {
  globals: viewport("mobile"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The menu button only exists below lg (e.g. opened outside the
    // Storybook UI at desktop width, where the sidebar is docked).
    const menu = canvas.queryByRole("button", { name: "Open menu" });
    if (!menu || window.innerWidth >= 1024) return;
    await userEvent.click(menu);
    await expect(
      canvas.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  },
};

/** The assistant opens full screen on phones. */
export const MobileChatOpen: Story = {
  beforeEach: () => {
    seedWebSession();
    useChatStore.setState({ isWidgetOpen: true });
  },
  globals: viewport("mobile"),
};
