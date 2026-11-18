import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreditsWidget } from "@/components/dashboard-widgets/widgets/credits-widget";
import {
  seedWebSession,
  withWebApp,
} from "../../../../.storybook/decorators/web";

const meta = {
  title: "Web/Dashboard/Widgets/CreditsWidget",
  component: CreditsWidget,
  decorators: [
    (Story) => (
      <div className="w-[28rem] max-w-full">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  beforeEach: () => seedWebSession({ balance: 1500 }),
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Dashboard widget (opt-in in Settings → Dashboard): balance and plan at a glance with a shortcut to buy credits. At 50 credits or less it suggests topping up.",
      },
    },
  },
} satisfies Meta<typeof CreditsWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LowBalance: Story = {
  beforeEach: () => seedWebSession({ balance: 12 }),
};
