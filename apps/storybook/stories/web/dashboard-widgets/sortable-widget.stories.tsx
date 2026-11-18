import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DASHBOARD_WIDGET_IDS } from "@creator-hub/shared-types";
import { fn } from "storybook/test";
import { SortableWidget } from "@/components/dashboard-widgets/sortable-widget";
import { seedWebSession, withWebApp } from "../../../.storybook/decorators/web";
import { dashboardApi } from "../../fixtures/dashboard";

const meta = {
  title: "Web/Dashboard/SortableWidget",
  component: SortableWidget,
  decorators: [
    (Story) => (
      // A cell of the dashboard grid (alone: nothing to swap with).
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  beforeEach: () => seedWebSession(),
  parameters: {
    layout: "fullscreen",
    api: dashboardApi(),
    docs: {
      description: {
        component:
          "One cell of the dashboard grid. Loads its widget (code + data) once the layout is known and the cell nears the viewport — until then a same-size placeholder. While rearranging it wobbles (alternating phase per `index`), its content is `inert`, `−` hides it and the grip button picks it up with the keyboard (44px targets on touch).",
      },
    },
  },
  args: {
    id: "activity",
    index: 0,
    editing: false,
    ready: true,
    onHide: fn(),
  },
  argTypes: {
    id: {
      description: "Widget shown in the cell.",
      control: "select",
      options: [...DASHBOARD_WIDGET_IDS],
    },
    index: {
      description: "Place in the grid (varies the wobble's phase/direction).",
      control: "number",
    },
    editing: {
      description: "Rearranging: wobble, inert content, `−` and grip badges.",
      control: "boolean",
    },
    ready: {
      description:
        "The user's layout is known; `false` keeps the placeholder (no widget code/data).",
      control: "boolean",
    },
    onHide: {
      description: "`−` was pressed: hide this widget.",
      table: { category: "Events" },
    },
  },
} satisfies Meta<typeof SortableWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Rearranging: Story = { args: { editing: true } };
export const FullWidth: Story = {
  name: "Full width (favorites)",
  args: { id: "favorites", editing: true },
};
export const Loading: Story = {
  name: "Layout not loaded yet",
  args: { ready: false },
};
