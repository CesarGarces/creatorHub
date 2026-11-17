import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { AnalysisHistory } from "@/components/video-clipper/analysis-history";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import { CLIPPER_HISTORY } from "../../fixtures/video-clipper";

const meta = {
  title: "Web/Video Clipper/AnalysisHistory",
  component: AnalysisHistory,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Recent analyses (`GET /tools/video-clipper/analyses`). Only the JSON result is stored — reopening one asks for the original video to preview and export its clips.",
      },
    },
  },
  argTypes: {
    items: { description: "History rows.", control: "object" },
    activeId: {
      description: "Analysis shown on the page.",
      control: "select",
      options: [null, "va1", "va2"],
    },
    onOpen: { description: "A row was opened.", table: { category: "Events" } },
    onDelete: {
      description: "Delete pressed on a row.",
      table: { category: "Events" },
    },
    className: { description: "Extra classes on the root.", control: "text" },
  },
  args: {
    items: CLIPPER_HISTORY,
    activeId: "va1",
    onOpen: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof AnalysisHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAnalyses: Story = {};
export const Empty: Story = { args: { items: [] } };
export const Mobile: Story = { globals: viewport("mobileSmall") };
