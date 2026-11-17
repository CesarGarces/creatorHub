import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LanguageSwitcher } from "@admin/components/language-switcher";
import { withAdminApp } from "../../.storybook/decorators/admin";

const meta = {
  title: "Admin/i18n/LanguageSwitcher",
  component: LanguageSwitcher,
  decorators: [withAdminApp],
  parameters: {
    docs: {
      description: {
        component:
          "The admin's wrapper of the shared language selector (sidebar footer and sign-in screen); confirms the switch with a top-center toast in the new language.",
      },
    },
  },
  argTypes: {
    compact: {
      description: "Flag + code instead of the full name.",
      control: "boolean",
    },
    align: {
      description: "Menu alignment.",
      control: "inline-radio",
      options: ["start", "center", "end"],
    },
    className: {
      description: "Extra classes for the trigger.",
      control: "text",
    },
  },
  args: { compact: false, align: "start" },
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sidebar: Story = {
  args: { className: "w-56 justify-start" },
};
export const Compact: Story = { args: { compact: true } };
