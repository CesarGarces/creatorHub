import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlannerStats } from "@/components/content-planner/planner-stats";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import { PLANNER_STATS } from "../../fixtures/planner";

const meta = {
  title: "Web/Content Planner/PlannerStats",
  component: PlannerStats,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Totals over the whole calendar (sessions, planned hours, completed). Shows “—” while loading (`stats={null}`).",
      },
    },
  },
  argTypes: {
    stats: {
      description:
        "`{ sessions, plannedMinutes, done }` or `null` while loading.",
      control: "object",
    },
  },
  args: { stats: PLANNER_STATS },
} satisfies Meta<typeof PlannerStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {};
export const Loading: Story = { args: { stats: null } };
export const Mobile: Story = { globals: viewport("mobileSmall") };
