import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { withWebApp } from "../../../.storybook/decorators/web";

const meta = {
  title: "Web/i18n/LanguageSelector",
  component: LanguageSelector,
  decorators: [withWebApp],
  parameters: {
    docs: {
      description: {
        component:
          "The web app's wrapper of the shared selector: after switching it shows a toast written in the new language, top-center so it never covers the selector.",
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
  args: { compact: false, align: "end" },
} satisfies Meta<typeof LanguageSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};
export const Compact: Story = { args: { compact: true } };
