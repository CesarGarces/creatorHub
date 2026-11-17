import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const PLANS = [
  {
    id: "plan_payg",
    slug: "PAY_AS_YOU_GO",
    name: "Pay as you go",
    usdAmount: 10,
    creditsGiven: 1000,
  },
  {
    id: "plan_starter",
    slug: "STARTER",
    name: "Starter",
    usdAmount: 25,
    creditsGiven: 2700,
  },
  {
    id: "plan_pro",
    slug: "PRO",
    name: "Pro",
    usdAmount: 50,
    creditsGiven: 6000,
  },
];

const meta = {
  title: "Web/Overlays/UpgradeModal",
  component: UpgradeModal,
  decorators: [withWebApp],
  parameters: {
    layout: "fullscreen",
    // Plans come from GET /credits/plans (mocked).
    api: { "/credits/plans": PLANS },
    docs: {
      description: {
        component:
          "Shown when a free user runs out of credits: credit packs (from `GET /credits/plans`), “Recharge now” and “Maybe later”.",
      },
      story: { inline: false, iframeHeight: 680 },
    },
  },
  argTypes: {
    isOpen: { description: "Controlled visibility.", control: "boolean" },
    onClose: {
      description: "× , backdrop, Escape or “Maybe later”.",
      table: { category: "Events" },
    },
  },
  args: { isOpen: true, onClose: fn() },
} satisfies Meta<typeof UpgradeModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Mobile: Story = { globals: viewport("mobile") };
