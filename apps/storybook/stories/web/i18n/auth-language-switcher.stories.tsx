import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AuthLanguageSwitcher } from "@/components/i18n/auth-language-switcher";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Web/i18n/AuthLanguageSwitcher",
  component: AuthLanguageSwitcher,
  decorators: [
    withWebApp,
    (Story) => (
      <div className="relative min-h-[20rem] bg-bg">
        <Story />
        <div className="px-4 pb-8 pt-[4.5rem] text-center text-sm text-text-muted sm:pt-12">
          Sign-in card…
        </div>
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Language selector pinned to the top-right corner of the sign-in screens (below the safe-area inset). The auth pages leave 4.5rem of top room on phones so it never covers the card.",
      },
    },
  },
} satisfies Meta<typeof AuthLanguageSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Mobile: Story = { globals: viewport("mobile") };
