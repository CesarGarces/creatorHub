import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BorderGlow } from "@creator-hub/ui";

const meta = {
  title: "UI/Effects/BorderGlow",
  component: BorderGlow,
  parameters: {
    docs: {
      description: {
        component:
          "Decorative glowing border that follows the pointer (or rotates when `animated`). Purely visual — wrap content that already works without it.",
      },
    },
  },
  argTypes: {
    animated: {
      description: "Rotate the glow continuously.",
      control: "boolean",
    },
    glowColor: {
      description: 'HSL triplet of the glow, e.g. `"40 80 80"`.',
      control: "text",
    },
    backgroundColor: {
      description: "Fill color inside the border.",
      control: "color",
    },
    borderRadius: {
      description: "Corner radius in px.",
      control: { type: "range", min: 0, max: 48 },
    },
    glowRadius: {
      description: "Glow spread in px.",
      control: { type: "range", min: 0, max: 120 },
    },
    glowIntensity: {
      description: "Glow strength.",
      control: { type: "range", min: 0, max: 2, step: 0.1 },
    },
    coneSpread: {
      description: "Width of the light cone (degrees).",
      control: { type: "range", min: 5, max: 90 },
    },
    colors: { description: "Gradient colors.", control: "object" },
    fillOpacity: {
      description: "Opacity of the gradient fill.",
      control: { type: "range", min: 0, max: 1, step: 0.05 },
    },
    speed: {
      description: "Rotation speed when animated.",
      control: { type: "range", min: 0.5, max: 5, step: 0.5 },
    },
    children: {
      description: "Content inside the glowing border.",
      control: false,
    },
  },
  args: {
    children: null,
    animated: true,
    backgroundColor: "#121826",
    borderRadius: 24,
  },
  render: ({ children: _content, ...args }) => (
    <BorderGlow {...args}>
      <div className="p-8 text-center">
        <p className="text-lg font-semibold text-text">Create your thumbnail</p>
        <p className="mt-1 text-sm text-text-muted">
          Describe it and press Generate.
        </p>
      </div>
    </BorderGlow>
  ),
} satisfies Meta<typeof BorderGlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Animated: Story = {};
export const FollowsPointer: Story = { args: { animated: false } };
