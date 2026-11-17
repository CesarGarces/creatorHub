import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { VideoDropzone } from "@/components/video-clipper/video-dropzone";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/Video Clipper/VideoDropzone",
  component: VideoDropzone,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Drag & drop or pick a local video (MP4/MOV/WebM, up to 250 MB). Nothing is uploaded: the page opens the file as an object URL and samples keyframes on a canvas.",
      },
    },
  },
  argTypes: {
    onFile: {
      description: "A file was picked or dropped.",
      table: { category: "Events" },
    },
    disabled: { description: "Ignore picks and drops.", control: "boolean" },
    className: { description: "Extra classes on the root.", control: "text" },
  },
  args: { onFile: fn(), disabled: false },
} satisfies Meta<typeof VideoDropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Mobile: Story = { globals: viewport("mobile") };
