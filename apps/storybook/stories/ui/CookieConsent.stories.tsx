import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookieConsent } from "@creator-hub/ui";
import { viewport } from "../../.storybook/viewports";

const CONSENT_KEY = "creator_hub_cookie_consent";

const meta = {
  title: "UI/Privacy/CookieConsent",
  component: CookieConsent,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Cookie banner shown until the visitor chooses (stored in `localStorage`). Inset on both sides on phones (safe-area aware), a corner card from `sm`. Optional `CookiesModal` opens the full policy.",
      },
      story: { inline: false, iframeHeight: 420 },
    },
  },
  argTypes: {
    CookiesModal: {
      description:
        "Component rendering the cookie policy (receives `open`/`onOpenChange`).",
      control: false,
    },
  },
  // Show the banner on every render of the story.
  beforeEach: () => {
    localStorage.removeItem(CONSENT_KEY);
  },
  decorators: [
    (Story) => (
      <div className="min-h-[24rem] p-6 text-sm text-text-muted">
        Page content…
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CookieConsent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Mobile: Story = { globals: viewport("mobile") };
