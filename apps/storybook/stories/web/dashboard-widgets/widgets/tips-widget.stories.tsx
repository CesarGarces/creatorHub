import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { TipsWidget } from "@/components/dashboard-widgets/widgets/tips-widget";
import {
  seedWebSession,
  withWebApp,
} from "../../../../.storybook/decorators/web";
import { viewport } from "../../../../.storybook/viewports";

const meta = {
  title: "Web/Dashboard/Widgets/TipsWidget",
  component: TipsWidget,
  decorators: [
    (Story) => (
      // A half-width dashboard cell.
      <div className="w-[32rem] max-w-full">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  beforeEach: () => seedWebSession(),
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Dashboard widget **Pro tip**: one of 100 tips on using Creator Hub (calendar, widgets, AI planner, scripts, thumbnails, clipper, social…) and growing a channel (viral videos), kept as JSON content in `apps/web/src/content/pro-tips/<locale>.json` — only the user's language is downloaded. A different tip every hour (changes at :00 on the user's clock): random order, every tip once per 100 hours, never the same twice in a row, a different order per user. Shows the category and the tip's number; the card keeps a minimum height so the widgets below don't move. Switch the toolbar language to see the translations.",
      },
    },
  },
} satisfies Meta<typeof TipsWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/^Tip \d+ of 100$/)).toBeVisible();
    await expect(canvas.getByText("A new tip every hour.")).toBeVisible();
  },
};

export const Phone: Story = { globals: viewport("mobileSmall") };
