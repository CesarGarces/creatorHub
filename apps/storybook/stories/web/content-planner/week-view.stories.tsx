import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { WeekView } from "@/components/content-planner/week-view";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import { PLANNER_EVENTS, WEEK_START } from "../../fixtures/planner";

const meta = {
  title: "Web/Content Planner/WeekView",
  component: WeekView,
  decorators: [withWebApp],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Week schedule of the Content Planner: sessions laid out per day and time, overlapping ones side by side. Click an empty slot to create a session, drag a session to move it, drag its top/bottom edge to resize it. " +
          "**Responsive:** below `md` the seven columns keep a readable width and the grid scrolls sideways inside its card (`data-scroll-x`, `min-w-[46rem]`) with the hour labels pinned (`sticky left-0`); the page itself never scrolls sideways.",
      },
    },
  },
  argTypes: {
    cursor: {
      description: "Any date inside the week to show.",
      control: "date",
    },
    events: {
      description: "Sessions (from `GET /tools/content-planner/events`).",
      control: "object",
    },
    focusedProjectId: {
      description: "Dims sessions of other projects (`null` = none focused).",
      control: "select",
      options: [null, "proj-1"],
    },
    onSelectEvent: {
      description: "A session was clicked (opens the edit dialog).",
      table: { category: "Events" },
    },
    onCreateAt: {
      description: "An empty slot was clicked (start date).",
      table: { category: "Events" },
    },
    onMoveEvent: {
      description: "A session was dropped on a new start.",
      table: { category: "Events" },
    },
    onResizeEvent: {
      description: "An edge was released after resizing.",
      table: { category: "Events" },
    },
  },
  args: {
    cursor: WEEK_START,
    events: PLANNER_EVENTS,
    focusedProjectId: null,
    onSelectEvent: fn(),
    onCreateAt: fn(),
    onMoveEvent: fn(),
    onResizeEvent: fn(),
  },
  render: (args) => (
    <div className="p-4 sm:p-6">
      <WeekView {...args} cursor={new Date(args.cursor)} />
    </div>
  ),
} satisfies Meta<typeof WeekView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };

export const FocusedProject: Story = {
  args: { focusedProjectId: "proj-1" },
  globals: viewport("desktop"),
};

/** Tablet portrait: the week fits without scrolling sideways. */
export const Tablet: Story = { globals: viewport("tablet") };

/** Phone: the grid scrolls sideways inside its card. */
export const Mobile: Story = { globals: viewport("mobile") };

export const EmptyWeek: Story = { args: { events: [] } };
