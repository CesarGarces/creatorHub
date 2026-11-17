import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "@creator-hub/ui";

const meta = {
  title: "UI/Feedback/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Loading placeholder. Size it with utilities (`h-8 w-full`, `aspect-video`, `rounded-xl`) to match the content it stands for.",
      },
    },
  },
  argTypes: {
    className: { description: "Size and shape utilities.", control: "text" },
  },
  args: { className: "h-8 w-64" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The loading state of a table: one bar per row. */
export const TableRows: Story = {
  render: () => (
    <div className="w-full max-w-xl space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  ),
};

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="aspect-video rounded-xl" />
      ))}
    </div>
  ),
};
