import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SuggestionsPanel } from "@/components/video-clipper/suggestions-panel";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import { CLIPPER_RESULT } from "../../fixtures/video-clipper";

const meta = {
  title: "Web/Video Clipper/SuggestionsPanel",
  component: SuggestionsPanel,
  decorators: [
    withWebApp,
    (Story) => (
      <div className="w-full max-w-md">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Structured output of the analysis for the whole video: summary, optimized titles, hooks and hashtags — each copyable.",
      },
    },
  },
  argTypes: {
    result: {
      description:
        "`summary`, `contentType`, `titles`, `hooks`, `hashtags` and `model` of the analysis.",
      control: "object",
    },
    onCopy: {
      description: "A text was copied.",
      table: { category: "Events" },
    },
    className: { description: "Extra classes on the root.", control: "text" },
  },
  args: { result: CLIPPER_RESULT, onCopy: fn() },
} satisfies Meta<typeof SuggestionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const TitlesOnly: Story = {
  args: { result: { ...CLIPPER_RESULT, summary: "", hooks: [], hashtags: [] } },
};
export const Mobile: Story = { globals: viewport("mobileSmall") };
