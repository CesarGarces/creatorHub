import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { LanguageOptions, LanguageSelector } from "@creator-hub/i18n";
import { viewport } from "../../.storybook/viewports";

const meta = {
  title: "i18n/LanguageSelector",
  component: LanguageSelector,
  subcomponents: { LanguageOptions },
  parameters: {
    docs: {
      description: {
        component:
          "Language switcher shared by the web app, landing page and admin (`@creator-hub/i18n`). Switching is instant and remembered in the `ch_locale` cookie; `onChanged` receives a confirmation already written in the new language (apps show it as a toast). " +
          "It follows the **Language** toolbar too. `LanguageOptions` is the full-width list used on the Settings page.",
      },
    },
  },
  argTypes: {
    compact: {
      description:
        "Flag + code (“🇺🇸 EN”) instead of the full name — for tight headers.",
      control: "boolean",
      table: { defaultValue: { summary: "false" } },
    },
    align: {
      description: "Menu alignment against the trigger.",
      control: "inline-radio",
      options: ["start", "center", "end"],
      table: { defaultValue: { summary: "end" } },
    },
    className: {
      description: "Extra classes for the trigger.",
      control: "text",
    },
    onChanged: {
      description: "`(locale, message)` after a successful switch.",
      table: { category: "Events" },
    },
  },
  args: { compact: false, align: "end", onChanged: fn() },
} satisfies Meta<typeof LanguageSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByTestId("language-selector"),
    );
    await userEvent.click(await screen.findByTestId("language-option-es"));
    await expect(args.onChanged).toHaveBeenCalledWith(
      "es",
      "Idioma cambiado a Español",
    );
    // Back to English so other stories start in the toolbar language.
    await userEvent.click(
      within(canvasElement).getByTestId("language-selector"),
    );
    await userEvent.click(await screen.findByTestId("language-option-en"));
  },
};

export const Compact: Story = { args: { compact: true } };

/** Inside a drawer on phones: full width and thumb-sized. */
export const FullWidthOnMobile: Story = {
  args: { align: "start", className: "h-11 w-full justify-start text-sm" },
  globals: viewport("mobile"),
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};

/** `LanguageOptions`: the Settings → Language list. */
export const OptionsList: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <LanguageOptions
        onChanged={args.onChanged}
        footer={<p className="text-xs text-text-dim">Saved on this device</p>}
      />
    </div>
  ),
};
