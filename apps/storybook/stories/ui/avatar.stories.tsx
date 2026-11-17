import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar } from "@creator-hub/ui";

const meta = {
  title: "UI/Data display/Avatar",
  component: Avatar,
  parameters: {
    docs: {
      description: {
        component:
          "User picture, or initials on a primary background when there is no `src` (e.g. the sidebar footer).",
      },
    },
  },
  argTypes: {
    name: {
      description: "Full name or email; its initials are the fallback.",
      control: "text",
    },
    src: { description: "Image URL (optional).", control: "text" },
    alt: { description: "Alternative text for the image.", control: "text" },
    size: {
      description: "`sm` 32px · `md` 40px · `lg` 48px.",
      control: "inline-radio",
      options: ["sm", "md", "lg"],
      table: { defaultValue: { summary: "md" } },
    },
  },
  args: { name: "Ana Creator", size: "md" },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} size="sm" />
      <Avatar {...args} size="md" />
      <Avatar {...args} size="lg" />
    </div>
  ),
};

export const WithImage: Story = {
  args: {
    src: "/isologo_white.png",
    alt: "Creator Hub",
  },
};
