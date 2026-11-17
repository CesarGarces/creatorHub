import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ToolCard } from "@creator-hub/ui";

const meta = {
  title: "UI/Data display/ToolCard",
  component: ToolCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'Clickable tool tile (`role="button"`, Enter/Space activate it) with an optional favourite toggle. ' +
          "**Utilities:** the favourite button grows to 44px on touch screens (`pointer-coarse:h-11 pointer-coarse:w-11`); inactive tools are dimmed and not focusable.",
      },
    },
  },
  argTypes: {
    name: { description: "Tool name.", control: "text" },
    description: {
      description: "One-line description (clamped to one line).",
      control: "text",
    },
    icon: { description: "Emoji icon.", control: "text" },
    category: { description: "Category tag shown top-right.", control: "text" },
    status: {
      description: "`active`, `beta` (shows a badge) or `inactive` (disabled).",
      control: "inline-radio",
      options: ["active", "beta", "inactive"],
    },
    isPremium: { description: "Shows the Premium badge.", control: "boolean" },
    isFavorite: { description: "Filled star when true.", control: "boolean" },
    credits: {
      description: "Credits per use (informational).",
      control: "number",
    },
    onClick: { description: "Opens the tool.", table: { category: "Events" } },
    onToggleFavorite: {
      description: "Star clicked (does not open the tool).",
      table: { category: "Events" },
    },
  },
  args: {
    name: "Thumbnail Generator",
    description: "AI-powered thumbnail generation for YouTube videos",
    icon: "🎨",
    category: "Thumbnail",
    status: "active",
    isPremium: false,
    isFavorite: false,
    credits: 1,
    onClick: fn(),
    onToggleFavorite: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ToolCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Add to favorites" }),
    );
    await expect(args.onToggleFavorite).toHaveBeenCalled();
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Favorite: Story = { args: { isFavorite: true } };
export const Beta: Story = {
  args: {
    name: "Content Translator",
    icon: "🌐",
    category: "Translator",
    status: "beta",
  },
};
export const Premium: Story = { args: { isPremium: true } };
export const Inactive: Story = { args: { status: "inactive" } };
