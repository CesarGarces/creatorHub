import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@creator-hub/ui";

const meta = {
  title: "UI/Data display/Card",
  component: Card,
  subcomponents: {
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
  },
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Surface container composed of `CardHeader` → `CardTitle`/`CardDescription`, `CardContent` and `CardFooter`. Every part accepts `className`; in grids use `grid-cols-1 sm:grid-cols-2 …` so cards stack on phones.",
      },
    },
  },
  argTypes: {
    className: { description: "Extra classes for the card.", control: "text" },
  },
  args: { className: "w-full max-w-sm" },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Starter</CardTitle>
        <CardDescription>Best value for getting started</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-text">$25.00</p>
        <p className="text-sm text-text-muted">2,700 credits</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Buy Credits</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlanCard: Story = {};

/** A responsive grid of cards: one column on phones, three from `md`. */
export const ResponsiveGrid: Story = {
  args: { className: "" },
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {["Pay as you go", "Starter", "Pro"].map((name) => (
        <Card key={name} {...args}>
          <CardHeader>
            <CardTitle>{name}</CardTitle>
            <CardDescription>Credits that never expire</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full">Buy Credits</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  ),
};
