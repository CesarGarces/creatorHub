import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { DashboardWidgetsCard } from "@/components/settings/dashboard-widgets-card";
import { seedWebSession, withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import {
  CUSTOM_LAYOUT,
  DEFAULT_LAYOUT,
  dashboardApi,
  seedDashboardLayout,
} from "../../fixtures/dashboard";

const meta = {
  title: "Web/Settings/DashboardWidgetsCard",
  component: DashboardWidgetsCard,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  beforeEach: () => {
    seedWebSession();
    seedDashboardLayout(DEFAULT_LAYOUT);
  },
  parameters: {
    layout: "padded",
    api: dashboardApi(DEFAULT_LAYOUT),
    docs: {
      description: {
        component:
          "Settings → Dashboard (`#dashboard`): every widget with a preview and description, a switch to show/hide it and up/down buttons to order it — the no-drag alternative to pressing and holding a widget on the dashboard. A live preview shows the result on a desktop (two columns, real sizes) or a phone. Changes save at once; **Reset to default** restores the original dashboard.",
      },
    },
  },
} satisfies Meta<typeof DashboardWidgetsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  globals: viewport("desktop"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const credits = canvas.getByRole("switch", {
      name: "Show Credits on the dashboard",
    });
    await userEvent.click(credits);
    await expect(credits).toHaveAttribute("aria-checked", "true");
    await expect(
      canvasElement.querySelector('[data-preview-widget="credits"]'),
    ).not.toBeNull();
  },
};

export const Customized: Story = {
  beforeEach: () => seedDashboardLayout(CUSTOM_LAYOUT),
  parameters: { api: dashboardApi(CUSTOM_LAYOUT) },
  globals: viewport("desktop"),
};

export const Phone: Story = { globals: viewport("mobile") };
