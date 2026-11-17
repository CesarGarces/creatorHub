import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@creator-hub/ui";

interface SheetArgs {
  side: "left" | "right" | "top" | "bottom";
  title: string;
  description: string;
}

const meta = {
  title: "UI/Overlays/Sheet",
  component: SheetContent,
  subcomponents: {
    Sheet,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Panel sliding in from an edge (`85vw`, max `24rem` on the sides; `85dvh` top/bottom, bottom sheets respect the safe-area inset).",
      },
    },
  },
  argTypes: {
    side: {
      description: "Edge the panel slides from.",
      control: "inline-radio",
      options: ["left", "right", "top", "bottom"],
      table: { defaultValue: { summary: "right" } },
    },
    title: { description: "Panel title.", control: "text" },
    description: { description: "Panel description.", control: "text" },
  },
  args: {
    side: "right",
    title: "Variations",
    description: "Pick a previous result to show it again.",
  },
  render: function Render(args) {
    const a = args as unknown as SheetArgs;
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open sheet</Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side={a.side}>
            <div className="flex h-full flex-col gap-4 p-6">
              <SheetHeader>
                <SheetTitle>{a.title}</SheetTitle>
                <SheetDescription>{a.description}</SheetDescription>
              </SheetHeader>
              <div className="flex-1" />
              <SheetFooter>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </SheetFooter>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  },
} satisfies Meta<SheetArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {};
export const Bottom: Story = { args: { side: "bottom" } };
