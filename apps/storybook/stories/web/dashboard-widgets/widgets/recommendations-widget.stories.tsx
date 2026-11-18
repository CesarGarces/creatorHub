import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecommendationsWidget } from "@/components/dashboard-widgets/widgets/recommendations-widget";
import { withWebApp } from "../../../../.storybook/decorators/web";
import { viewport } from "../../../../.storybook/viewports";

const meta = {
  title: "Web/Dashboard/Widgets/RecommendationsWidget",
  component: RecommendationsWidget,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Dashboard widget: recommended agents, as links. Cards sit side by side only when the widget itself is wide enough (container query `@xl`): full width on tablets, stacked in a half-width desktop cell.",
      },
    },
  },
} satisfies Meta<typeof RecommendationsWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wide: Story = {};
export const HalfWidthCell: Story = {
  name: "Half-width cell",
  decorators: [
    (Story) => (
      <div className="w-[28rem] max-w-full">
        <Story />
      </div>
    ),
  ],
};
export const Phone: Story = { globals: viewport("mobileSmall") };
