import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatsCards } from "@admin/components/dashboard/stats-cards";
import { withAdminApp } from "../../../.storybook/decorators/admin";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Admin/Dashboard/StatsCards",
  component: StatsCards,
  decorators: [withAdminApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Platform totals. Two columns on phones (`grid-cols-2`), four from `lg`, with compact padding and numbers below `sm`.",
      },
    },
  },
  argTypes: {
    stats: {
      description: "Totals from `GET /admin/dashboard/stats`.",
      control: "object",
    },
  },
  args: {
    stats: {
      totalUsers: 1250,
      activeUsers: 1100,
      inactiveUsers: 150,
      totalProviders: 4,
      activeProviders: 3,
      totalCreditsUsed: 48200,
      totalCreditsRemaining: 91000,
      totalFavorites: 320,
    },
  },
} satisfies Meta<typeof StatsCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Mobile: Story = { globals: viewport("mobile") };
