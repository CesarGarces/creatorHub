import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActivityWidget } from "@/components/dashboard-widgets/widgets/activity-widget";
import {
  seedWebSession,
  withWebApp,
} from "../../../../.storybook/decorators/web";
import { viewport } from "../../../../.storybook/viewports";
import { dashboardApi } from "../../../fixtures/dashboard";

const meta = {
  title: "Web/Dashboard/Widgets/ActivityWidget",
  component: ActivityWidget,
  decorators: [withWebApp],
  beforeEach: () => seedWebSession(),
  parameters: {
    layout: "padded",
    api: dashboardApi(),
    docs: {
      description: {
        component:
          "Dashboard widget: the last five credit movements (tools used, purchases with their payment status, bonuses) and a link to the full history. Rows of the same size hold the list while it loads.",
      },
    },
  },
} satisfies Meta<typeof ActivityWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
  name: "No activity yet",
  parameters: { api: { "/credits/transactions": [] } },
};
export const Phone: Story = { globals: viewport("mobileSmall") };
