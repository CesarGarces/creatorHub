import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ShareModal } from "@/components/share-modal";
import { withWebApp } from "../../.storybook/decorators/web";
import { viewport } from "../../.storybook/viewports";

const meta = {
  title: "Web/Overlays/ShareModal",
  component: ShareModal,
  decorators: [withWebApp],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Share an asset: copy its public link or open a social network. Private assets show a warning with “Make public now”. Stacks above the asset preview it opens from (`z-[130]`), sized to the visible viewport with its own scroll area.",
      },
      story: { inline: false, iframeHeight: 640 },
    },
  },
  argTypes: {
    assetId: {
      description: "Asset id, used in the share URL.",
      control: "text",
    },
    assetPrompt: {
      description: "Prompt, used as the share text.",
      control: "text",
    },
    assetType: {
      description: "`IMAGE` or `VIDEO`.",
      control: "inline-radio",
      options: ["IMAGE", "VIDEO"],
    },
    isPublic: {
      description: "Sharing is only possible for public assets.",
      control: "boolean",
    },
    onTogglePublic: {
      description: "“Make public now” pressed.",
      table: { category: "Events" },
    },
    onClose: { description: "× or backdrop.", table: { category: "Events" } },
  },
  args: {
    assetId: "img-1",
    assetPrompt: "Gaming thumbnail with neon lights and a shocked face",
    assetType: "IMAGE",
    isPublic: true,
    onTogglePublic: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof ShareModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Public: Story = { globals: viewport("desktop") };
export const Private: Story = { args: { isPublic: false } };
export const Mobile: Story = { globals: viewport("mobileSmall") };
