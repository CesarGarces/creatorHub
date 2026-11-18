import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DashboardLayoutPreview } from "@/components/dashboard-widgets/layout-preview";
import { withWebApp } from "../../../.storybook/decorators/web";

const meta = {
  title: "Web/Dashboard/DashboardLayoutPreview",
  component: DashboardLayoutPreview,
  decorators: [
    (Story) => (
      <div className="w-[36rem] max-w-full">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The dashboard in miniature, as it will look: two columns with the real widget sizes on a desktop, one column on a phone. Settings → Dashboard updates it live as widgets are shown, hidden or moved.",
      },
    },
  },
  args: {
    widgetIds: [
      "quick-prompt",
      "favorites",
      "activity",
      "recommendations",
      "tips",
    ],
    device: "desktop",
  },
  argTypes: {
    widgetIds: {
      description: "Visible widgets, in order.",
      control: "object",
    },
    device: {
      description: "Layout to preview.",
      control: "inline-radio",
      options: ["desktop", "phone"],
    },
    className: { description: "Extra classes on the frame.", control: "text" },
  },
} satisfies Meta<typeof DashboardLayoutPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const Phone: Story = { args: { device: "phone" } };
export const Empty: Story = { name: "No widgets", args: { widgetIds: [] } };
