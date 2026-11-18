import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { AssetStatsWidget } from "@/components/dashboard-widgets/widgets/asset-stats-widget";
import {
  seedWebSession,
  withWebApp,
} from "../../../../.storybook/decorators/web";
import { viewport } from "../../../../.storybook/viewports";
import { dashboardApi } from "../../../fixtures/dashboard";

const meta = {
  title: "Web/Dashboard/Widgets/AssetStatsWidget",
  component: AssetStatsWidget,
  decorators: [
    (Story) => (
      // A half-width dashboard cell, like "Plans for today".
      <div className="w-[32rem] max-w-full">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  beforeEach: () => seedWebSession(),
  parameters: {
    layout: "padded",
    api: dashboardApi(),
    docs: {
      description: {
        component:
          "Dashboard widget **Likes & views** (`GET /user/assets/engagement`), the size of *Plans for today* (a half-width card of rows): the total likes and views of the user's assets, then the most liked ones as rows — a small 16:9 **still** (the image, or a video's first-frame thumbnail marked ▶; no video is loaded or played; none → placeholder), the title and its likes and views (compact on screen, in full for screen readers). Shared assets open their public page in a new tab (↗, announced to screen readers) so the dashboard stays open; private ones open the Assets page. A broken preview falls back to the placeholder.",
      },
    },
  },
} satisfies Meta<typeof AssetStatsWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("1,280")).toBeVisible();
    await expect(canvas.getByText("45,210")).toBeVisible();
    await expect(canvasElement.querySelector("video")).toBeNull();
  },
};

export const NoEngagementYet: Story = {
  name: "No likes or views yet",
  parameters: {
    api: {
      "/user/assets/engagement": {
        totals: { likes: 0, views: 0, assets: 3, publicAssets: 0 },
        top: [],
      },
    },
  },
};

export const Phone: Story = { globals: viewport("mobileSmall") };
