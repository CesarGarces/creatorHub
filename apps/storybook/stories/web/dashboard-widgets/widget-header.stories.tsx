import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WidgetHeader } from "@/components/dashboard-widgets/widget-header";
import { withWebApp } from "../../../.storybook/decorators/web";

const meta = {
  title: "Web/Dashboard/WidgetHeader",
  component: WidgetHeader,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Title row of a dashboard widget, in the dashboard's section-title style, with an optional action on the right.",
      },
    },
  },
  args: { title: "Recent Activity" },
  argTypes: {
    title: { description: "Widget title (an `h2`).", control: "text" },
    action: {
      description: "Optional link/button on the right, e.g. “View all”.",
      control: false,
    },
    className: { description: "Extra classes on the row.", control: "text" },
  },
} satisfies Meta<typeof WidgetHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithAction: Story = {
  args: {
    action: (
      <a href="/history" className="text-xs text-primary">
        View all →
      </a>
    ),
  },
};
