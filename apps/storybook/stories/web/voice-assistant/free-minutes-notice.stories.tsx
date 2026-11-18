import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { FreeMinutesNotice } from "@/components/voice-assistant/free-minutes-notice";
import { withWebApp } from "../../../.storybook/decorators/web";

const allowance = (
  remainingSeconds: number,
  period: "monthly" | "lifetime" = "monthly",
) => ({
  limited: true,
  period,
  limitSeconds: 600,
  usedSeconds: 600 - remainingSeconds,
  remainingSeconds,
  exhausted: remainingSeconds === 0,
  resetsAt: period === "monthly" ? "2026-12-01T00:00:00.000Z" : null,
});

const meta = {
  title: "Web/Voice assistant/FreeMinutesNotice",
  component: FreeMinutesNotice,
  decorators: [
    (Story) => (
      <div className="w-[26rem] max-w-full">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The Free plan's minutes with Robotina (set in Admin → Voice, §14h): a quiet line with the minutes left while there are some; once used up, an invitation to **upgrade for unlimited use** (link to Credits) — with the date they come back for a monthly limit. Nothing for paid plans or when no limit is set. Shown on the tool page and, compact, on the dashboard widget.",
      },
    },
  },
  argTypes: {
    allowance: {
      description: "The user's allowance (`GET /voice/allowance`).",
      control: "object",
    },
    compact: {
      description: "Smaller (dashboard widget).",
      control: "boolean",
    },
    className: { description: "Extra classes.", control: "text" },
  },
  args: { allowance: allowance(420), compact: false },
} satisfies Meta<typeof FreeMinutesNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MinutesLeft: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        "Free plan: 7 of 10 minutes with Robotina left this month",
      ),
    ).toBeVisible();
  },
};

export const UsedUpThisMonth: Story = {
  args: { allowance: allowance(0) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("You've used your 10 free minutes with Robotina"),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Upgrade for unlimited use" }),
    ).toHaveAttribute("href", "/credits");
  },
};

export const UsedUpForGood: Story = {
  args: { allowance: allowance(0, "lifetime") },
};

export const CompactOnTheWidget: Story = {
  args: { allowance: allowance(0), compact: true },
};
