import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DASHBOARD_WIDGET_IDS } from "@creator-hub/shared-types";
import { WidgetSkeleton } from "@/components/dashboard-widgets/widget-skeleton";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/Dashboard/WidgetSkeleton",
  component: WidgetSkeleton,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Placeholder of a widget while its code or data loads, with the widget's real geometry (same grids, rows, heights) — nothing below moves when the widget arrives (CLS gate). Hidden from assistive tech.",
      },
    },
  },
  args: { id: "favorites" },
  argTypes: {
    id: {
      description: "Widget whose placeholder to draw.",
      control: "select",
      options: [...DASHBOARD_WIDGET_IDS],
    },
    className: { description: "Extra classes on the root.", control: "text" },
  },
} satisfies Meta<typeof WidgetSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Favorites: Story = {};
export const Activity: Story = { args: { id: "activity" } };
export const QuickPrompt: Story = { args: { id: "quick-prompt" } };
export const Phone: Story = { globals: viewport("mobileSmall") };
