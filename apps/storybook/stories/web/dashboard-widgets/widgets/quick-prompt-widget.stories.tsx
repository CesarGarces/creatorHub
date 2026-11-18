import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuickPromptWidget } from "@/components/dashboard-widgets/widgets/quick-prompt-widget";
import { withWebApp } from "../../../../.storybook/decorators/web";
import { viewport } from "../../../../.storybook/viewports";

const meta = {
  title: "Web/Dashboard/Widgets/QuickPromptWidget",
  component: QuickPromptWidget,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Dashboard widget: describe what to create and send it to the assistant chat, or pick an example. Its state is local, so typing re-renders only the prompt. Examples wrap on phones and tuck under the box from `sm`. A long press in the field never lifts the widget.",
      },
    },
  },
} satisfies Meta<typeof QuickPromptWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Phone: Story = { globals: viewport("mobileSmall") };
