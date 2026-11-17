import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { History, Image, Languages, Video } from "lucide-react";
import {
  Button,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@creator-hub/ui";

interface CommandArgs {
  /** Accessible name of the command list (cmdk `label`). */
  label: string;
  placeholder: string;
  onRun: (value: string) => void;
}

const ITEMS = [
  { group: "Tools", label: "Thumbnail Generator", icon: Image },
  { group: "Tools", label: "Video Generator", icon: Video },
  { group: "Tools", label: "Content Translator", icon: Languages },
  { group: "Navigation", label: "History", icon: History },
];

function Items({ onRun }: { onRun: (value: string) => void }) {
  return (
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      {["Tools", "Navigation"].map((group, i) => (
        <div key={group}>
          {i > 0 && <CommandSeparator />}
          <CommandGroup heading={group}>
            {ITEMS.filter((item) => item.group === group).map((item) => (
              <CommandItem key={item.label} onSelect={() => onRun(item.label)}>
                <item.icon className="h-4 w-4" />
                {item.label}
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </div>
      ))}
    </CommandList>
  );
}

const meta = {
  title: "UI/Overlays/Command",
  component: Command,
  subcomponents: {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
    CommandShortcut,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Searchable command list (cmdk). `CommandDialog` is the ⌘K / Ctrl+K palette of the web app. Items are selectable by keyboard, mouse and touch (`data-[disabled=true]` styles only apply to disabled items); the dialog shrinks with the visible viewport.",
      },
    },
  },
  argTypes: {
    label: {
      description: "Accessible name of the command list.",
      control: "text",
    },
    placeholder: { description: "Search field placeholder.", control: "text" },
    onRun: {
      description: "Item chosen (receives its label).",
      table: { category: "Events" },
    },
  },
  args: {
    label: "Command menu",
    placeholder: "Search tools, agents, pages...",
    onRun: fn(),
  },
} satisfies Meta<CommandArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inline list (no dialog). */
export const Inline: Story = {
  render: (args) => {
    const a = args as unknown as CommandArgs;
    return (
      <Command
        label={a.label}
        className="w-[min(28rem,calc(100vw-2rem))] border border-border"
      >
        <CommandInput placeholder={a.placeholder} />
        <Items onRun={a.onRun} />
      </Command>
    );
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("combobox"), "video");
    await userEvent.click(
      canvas.getByRole("option", { name: /Video Generator/ }),
    );
    await expect((args as unknown as CommandArgs).onRun).toHaveBeenCalledWith(
      "Video Generator",
    );
  },
};

/** The palette: open it with the button or ⌘K / Ctrl+K. */
export const Palette: Story = {
  render: function Render(args) {
    const a = args as unknown as CommandArgs;
    const [open, setOpen] = useState(false);
    return (
      <div
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Button variant="outline" onClick={() => setOpen(true)}>
          Search… <kbd className="ml-2 text-[10px]">⌘K</kbd>
        </Button>
        <CommandDialog
          open={open}
          onOpenChange={setOpen}
          label="Command palette"
        >
          <CommandInput autoFocus placeholder={a.placeholder} />
          <Items
            onRun={(value) => {
              a.onRun(value);
              setOpen(false);
            }}
          />
        </CommandDialog>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Search/ }),
    );
    await expect(
      await screen.findByPlaceholderText("Search tools, agents, pages..."),
    ).toBeVisible();
  },
};
