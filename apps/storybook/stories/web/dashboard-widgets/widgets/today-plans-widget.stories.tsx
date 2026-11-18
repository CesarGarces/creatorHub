import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { TodayPlansWidget } from "@/components/dashboard-widgets/widgets/today-plans-widget";
import {
  seedWebSession,
  withWebApp,
} from "../../../../.storybook/decorators/web";
import { viewport } from "../../../../.storybook/viewports";
import { dashboardApi } from "../../../fixtures/dashboard";

const meta = {
  title: "Web/Dashboard/Widgets/TodayPlansWidget",
  component: TodayPlansWidget,
  decorators: [
    (Story) => (
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
          "Dashboard widget **Plans for today**: the Content Planner sessions of the user's local day (`GET /tools/content-planner/events`, midnight to midnight), each with its **name**, its **description** (the session notes, else its video) and its time, in the calendar's type colours. On the right, the time to each session (“in 1 h 30 min”), “Now”, or how long ago it passed — **in red** when its time is over and it isn't marked done. Sessions are ordered **closest to now first** (happening now, then by distance to the current time: time until an upcoming one starts or since a past one ended). Done ones stay but quieter, cancelled ones are left out; at most five, then “+N more”. A session opens the planner on its week. Follows the clock (“Now”, a new day after midnight).",
      },
    },
  },
} satisfies Meta<typeof TodayPlansWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Record the unboxing")).toBeVisible();
    await expect(
      canvas.getByText(/Two cameras, natural light by the window/),
    ).toBeVisible();
  },
};

export const NothingPlanned: Story = {
  name: "Nothing planned today",
  parameters: { api: { "/tools/content-planner/events": { data: [] } } },
};

export const Phone: Story = { globals: viewport("mobileSmall") };
