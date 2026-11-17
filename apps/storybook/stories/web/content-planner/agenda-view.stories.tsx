import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AgendaView } from "@/components/content-planner/agenda-view";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import { PLANNER_EVENTS } from "../../fixtures/planner";

const meta = {
  title: "Web/Content Planner/AgendaView",
  component: AgendaView,
  decorators: [withWebApp],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'Sessions in date/time order, grouped by day — the default planner view on phones. Each row has a done toggle (`role="checkbox"`, 28px on touch) and opens the session when tapped. ' +
          "**Responsive:** on phones the time range sits on its own line above the title.",
      },
    },
  },
  argTypes: {
    events: {
      description: "Sessions to list (any order; sorted by start).",
      control: "object",
    },
    focusedProjectId: {
      description: "Only this project's sessions (`null` = all).",
      control: "select",
      options: [null, "proj-1"],
    },
    onSelectEvent: {
      description: "A session was tapped.",
      table: { category: "Events" },
    },
    onToggleDone: {
      description: "The done toggle was pressed.",
      table: { category: "Events" },
    },
    onPlanVideo: {
      description: "“Plan a video” from the empty state.",
      table: { category: "Events" },
    },
  },
  args: {
    events: PLANNER_EVENTS,
    focusedProjectId: null,
    onSelectEvent: fn(),
    onToggleDone: fn(),
    onPlanVideo: fn(),
  },
  render: (args) => (
    <div className="p-4 sm:p-6">
      <AgendaView {...args} />
    </div>
  ),
} satisfies Meta<typeof AgendaView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile: Story = {
  globals: viewport("mobile"),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getAllByRole("checkbox", { name: "Mark as done" })[0]!,
    );
    await expect(args.onToggleDone).toHaveBeenCalled();
  },
};

export const Desktop: Story = { globals: viewport("desktop") };

export const Empty: Story = { args: { events: [] } };
