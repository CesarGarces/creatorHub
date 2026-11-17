import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { MonthView } from "@/components/content-planner/month-view";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import { PLANNER_EVENTS, WEEK_START } from "../../fixtures/planner";

const meta = {
  title: "Web/Content Planner/MonthView",
  component: MonthView,
  decorators: [withWebApp],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Month grid: up to three sessions per day (then “+N more”, which opens that week). Clicking a day creates a session at 10:00. " +
          "**Responsive:** below `md` the grid keeps readable cells and scrolls sideways inside its card.",
      },
    },
  },
  argTypes: {
    cursor: {
      description: "Any date inside the month to show.",
      control: "date",
    },
    events: {
      description: "Sessions of the visible range.",
      control: "object",
    },
    focusedProjectId: {
      description: "Dims other projects' sessions.",
      control: "select",
      options: [null, "proj-1"],
    },
    onSelectEvent: {
      description: "A session was clicked.",
      table: { category: "Events" },
    },
    onCreateOnDay: {
      description: "A day was clicked (midnight of that day).",
      table: { category: "Events" },
    },
    onShowDay: {
      description: "“+N more” clicked (opens that week).",
      table: { category: "Events" },
    },
  },
  args: {
    cursor: WEEK_START,
    events: PLANNER_EVENTS,
    focusedProjectId: null,
    onSelectEvent: fn(),
    onCreateOnDay: fn(),
    onShowDay: fn(),
  },
  render: (args) => (
    <div className="p-4 sm:p-6">
      <MonthView {...args} cursor={new Date(args.cursor)} />
    </div>
  ),
} satisfies Meta<typeof MonthView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Mobile: Story = { globals: viewport("mobile") };
