import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HeavyFilesNote } from "@/components/video-clipper/heavy-files-note";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/Video Clipper/HeavyFilesNote",
  component: HeavyFilesNote,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Roadmap note of the Video Clipper: heavy camera files (up to 10 GB) are coming in a future release; today videos up to 250 MB are processed in the browser. Emphasized after the user picks a file over the limit.",
      },
    },
  },
  argTypes: {
    emphasized: {
      description:
        "Highlighted (warning colours) after a file over 250 MB was rejected.",
      control: "boolean",
    },
    className: { description: "Extra classes on the root.", control: "text" },
  },
  args: { emphasized: false },
} satisfies Meta<typeof HeavyFilesNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Emphasized: Story = { args: { emphasized: true } };
export const Mobile: Story = { globals: viewport("mobileSmall") };
