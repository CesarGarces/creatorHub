import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DASHBOARD_WIDGET_IDS } from "@creator-hub/shared-types";
import { WidgetPreview } from "@/components/dashboard-widgets/widget-preview";
import { withWebApp } from "../../../.storybook/decorators/web";

const meta = {
  title: "Web/Dashboard/WidgetPreview",
  component: WidgetPreview,
  decorators: [withWebApp],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Miniature of a widget for Settings → Dashboard: shapes only — no widget code or data is loaded to draw it. Decorative (`aria-hidden`); the widget's name is always shown next to it. Fills its container.",
      },
    },
  },
  args: { id: "favorites", muted: false, className: "h-16 w-28" },
  argTypes: {
    id: {
      description: "Widget to draw.",
      control: "select",
      options: [...DASHBOARD_WIDGET_IDS],
    },
    muted: {
      description: "Greyed out: the widget is hidden.",
      control: "boolean",
    },
    className: { description: "Extra classes (size).", control: "text" },
  },
} satisfies Meta<typeof WidgetPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Favorites: Story = {};
export const Hidden: Story = { args: { id: "credits", muted: true } };
export const AllWidgets: Story = {
  name: "Every widget",
  render: (args) => (
    <div className="grid w-[30rem] max-w-full grid-cols-2 gap-3 sm:grid-cols-3">
      {DASHBOARD_WIDGET_IDS.map((id) => (
        <WidgetPreview key={id} {...args} id={id} className="h-16" />
      ))}
    </div>
  ),
};
