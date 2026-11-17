import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Textarea } from "@creator-hub/ui";

const meta = {
  title: "UI/Forms/Textarea",
  component: Textarea,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Multi-line text field with the same label/error contract as `Input`. Not resizable by default (`resize-none`); pass `rows` for its height.",
      },
    },
  },
  argTypes: {
    label: {
      description: "Visible label linked to the field.",
      control: "text",
    },
    error: { description: "Error message under the field.", control: "text" },
    placeholder: { description: "Hint shown while empty.", control: "text" },
    rows: {
      description: "Visible lines of text.",
      control: { type: "number", min: 1, max: 12 },
    },
    maxLength: { description: "Maximum characters.", control: "number" },
    disabled: { description: "Native disabled state.", control: "boolean" },
    onChange: { description: "Change handler.", table: { category: "Events" } },
  },
  args: {
    label: "Describe your video",
    placeholder: "What is the video about? Who is it for?",
    rows: 4,
    disabled: false,
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithError: Story = {
  args: {
    error: "Tell us a bit more (at least 20 characters)",
    defaultValue: "Cooking",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "A beginner video about sourdough bread",
  },
};
