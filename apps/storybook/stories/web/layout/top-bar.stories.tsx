import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { Search } from "lucide-react";
import { TopBar } from "@/components/layout/top-bar";
import type { Notification } from "@/store/notification.store";
import { seedWebSession, withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    userId: "u1",
    type: "GENERATION_COMPLETE",
    title: "Your thumbnail is ready",
    body: "“Gaming thumbnail with neon lights” finished rendering.",
    data: null,
    readAt: null,
    createdAt: hoursAgo(1),
  },
  {
    id: "n2",
    userId: "u1",
    type: "CREDIT_PURCHASE",
    title: "Payment received",
    body: "2,700 credits were added to your balance.",
    data: null,
    readAt: hoursAgo(20),
    createdAt: hoursAgo(24),
  },
];

const meta = {
  title: "Web/Navigation/TopBar",
  component: TopBar,
  decorators: [withWebApp],
  beforeEach: () => seedWebSession(),
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Sticky page header: menu button (below `lg`, opens the navigation drawer), title or breadcrumbs, page actions, language, credits and notifications. " +
          "**Responsive:** phones show only the current breadcrumb (truncated), the credits pill in its short form and move the language switcher into the drawer; touch targets are 44px (`pointer-coarse:h-11`).",
      },
    },
  },
  argTypes: {
    title: {
      description: "Page title (`<h1>`), used when there are no breadcrumbs.",
      control: "text",
    },
    breadcrumbs: {
      description:
        "Trail of `{ label, href? }`; the last item is the current page.",
      control: "object",
    },
    actions: {
      description: "Page actions rendered after the title (buttons, badges).",
      control: false,
    },
    className: {
      description: "Extra classes for the `<header>`.",
      control: "text",
    },
  },
  args: {
    breadcrumbs: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Tools", href: "/tools" },
      { label: "Content Planner" },
    ],
  },
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Tablet: Story = { globals: viewport("tablet") };
export const Mobile: Story = { globals: viewport("mobile") };

export const WithTitle: Story = {
  args: { breadcrumbs: undefined, title: "Community Bot" },
};

/** Page actions become icon-only on phones (here the dashboard search). */
export const WithActions: Story = {
  args: {
    breadcrumbs: [{ label: "Dashboard" }],
    actions: (
      <button
        type="button"
        aria-label="Search..."
        className="flex h-9 min-w-9 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm text-text-dim pointer-coarse:h-11 pointer-coarse:min-w-11 sm:px-3"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search...</span>
      </button>
    ),
  },
  globals: viewport("mobile"),
};

export const WithNotifications: Story = {
  beforeEach: () => seedWebSession({ notifications: NOTIFICATIONS }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Open notifications" }),
    );
    await expect(
      await screen.findByText("2,700 credits were added to your balance."),
    ).toBeVisible();
  },
};

/** Below 50 credits a “buy credits” notice joins the notifications. */
export const LowCredits: Story = {
  beforeEach: () => seedWebSession({ balance: 20 }),
};
