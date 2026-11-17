import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreditDisplay } from "@creator-hub/ui";
import { viewport } from "../../.storybook/viewports";

const meta = {
  title: "UI/Data display/CreditDisplay",
  component: CreditDisplay,
  parameters: {
    docs: {
      description: {
        component:
          "Credit balance pill. The color follows the balance: red under 100, amber under 500, green otherwise. " +
          "`compactOnMobile` shows the short form (“1,500 cr”) below `sm` — the full text stays available to screen readers (`max-sm:sr-only`).",
      },
    },
  },
  argTypes: {
    balance: {
      description: "Credits available.",
      control: { type: "number", min: 0, step: 50 },
    },
    size: {
      description: "`sm` in headers, `md` elsewhere.",
      control: "inline-radio",
      options: ["sm", "md"],
      table: { defaultValue: { summary: "md" } },
    },
    compactOnMobile: {
      description: "Short label on phones (used by the web top bar).",
      control: "boolean",
      table: { defaultValue: { summary: "false" } },
    },
  },
  args: { balance: 1500, size: "md", compactOnMobile: false },
} satisfies Meta<typeof CreditDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const BalanceLevels: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <CreditDisplay {...args} balance={40} />
      <CreditDisplay {...args} balance={320} />
      <CreditDisplay {...args} balance={1500} />
    </div>
  ),
};

/** Open with the mobile viewport: the pill shows “1,500 cr”. */
export const CompactOnMobile: Story = {
  args: { compactOnMobile: true, size: "sm" },
  globals: viewport("mobile"),
};
