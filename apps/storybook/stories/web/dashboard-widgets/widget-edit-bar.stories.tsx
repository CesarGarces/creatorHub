import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { WidgetEditBar } from "@/components/dashboard-widgets/widget-edit-bar";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/Dashboard/WidgetEditBar",
  component: WidgetEditBar,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Bar shown while the dashboard is being rearranged: what to do, **Add widgets** (Settings → Dashboard) and **Done**. Sticks under the top bar so Done stays reachable on long dashboards; 44px controls on touch screens.",
      },
    },
  },
  args: { onDone: fn() },
  argTypes: {
    onDone: {
      description: "Done was pressed (finish rearranging).",
      table: { category: "Events" },
    },
    className: { description: "Extra classes on the root.", control: "text" },
  },
} satisfies Meta<typeof WidgetEditBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("link", { name: "Add widgets" }),
    ).toHaveAttribute("href", "/settings#dashboard");
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await expect(args.onDone).toHaveBeenCalled();
  },
};

export const Phone: Story = { globals: viewport("mobileSmall") };
