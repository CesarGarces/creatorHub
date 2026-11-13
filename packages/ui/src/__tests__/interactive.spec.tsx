import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  ActionConfirmDialog,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CookieConsent,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  LoadingSpinner,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
  Switch,
  ToolCard,
} from "../index";

afterEach(() => {
  document.body.style.overflow = "";
  localStorage.clear();
});

describe("Dialog", () => {
  it("renders nothing while closed", () => {
    render(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Hidden</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("portals content to the body and locks page scroll while open", () => {
    const { unmount } = render(
      <div data-testid="app">
        <Dialog open>
          <DialogContent>
            <DialogTitle>Edit</DialogTitle>
          </DialogContent>
        </Dialog>
      </div>,
    );

    expect(screen.getByTestId("app").textContent).toBe("");
    expect(document.body.textContent).toContain("Edit");
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes via the close button, the backdrop and Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog open>
        <DialogContent onClose={onClose}>
          <DialogTitle>Edit</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByText("Close"));
    fireEvent.click(document.querySelector(".bg-black\\/60") as Element);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("has no close button without an onClose handler", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Read only</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText("Close")).toBeNull();
  });
});

describe("Sheet", () => {
  it("slides in from the requested side and locks scroll", () => {
    render(
      <Sheet open>
        <SheetContent side="left" data-testid="sheet">
          <SheetTitle>Menu</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByText("Menu")).toBeTruthy();
    expect(screen.getByTestId("sheet").className).toContain("left-0");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("renders nothing while closed", () => {
    render(
      <Sheet open={false}>
        <SheetContent>
          <SheetTitle>Menu</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.queryByText("Menu")).toBeNull();
  });
});

describe("ActionConfirmDialog", () => {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    confirmLabel: "Delete",
    cancelLabel: "Keep",
  };

  beforeEach(() => vi.clearAllMocks());

  it("shows the title, description and both actions", () => {
    render(
      <ActionConfirmDialog {...props} description="This cannot be undone." />,
    );

    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Confirm Action")).toBeTruthy();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();

    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Keep"));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and backdrop click", () => {
    render(<ActionConfirmDialog {...props} />);

    fireEvent.keyDown(document, { key: "Escape" });
    const backdrop = screen.getByRole("dialog")
      .previousElementSibling as Element;
    fireEvent.click(backdrop);

    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("disables both buttons while the action runs", () => {
    render(<ActionConfirmDialog {...props} isLoading />);

    expect(
      (screen.getByText("Delete").closest("button") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect((screen.getByText("Keep") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders nothing while closed and stops listening for Escape", () => {
    render(<ActionConfirmDialog {...props} isOpen={false} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

describe("AlertDialog (Radix)", () => {
  it("opens from its trigger and runs the chosen action", () => {
    const onAction = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Remove</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Remove item?</AlertDialogTitle>
          <AlertDialogDescription>Gone for good.</AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onAction}>Confirm</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );

    fireEvent.click(screen.getByText("Remove"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    fireEvent.click(screen.getByText("Confirm"));
    expect(onAction).toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("DropdownMenu / Popover (Radix)", () => {
  it("opens a dropdown and selects an item", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Options</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    fireEvent.pointerDown(screen.getByText("Options"), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(onSelect).toHaveBeenCalled();
  });

  it("toggles popover content from its trigger", () => {
    render(
      <Popover>
        <PopoverTrigger>Info</PopoverTrigger>
        <PopoverContent>Details here</PopoverContent>
      </Popover>,
    );

    expect(screen.queryByText("Details here")).toBeNull();
    fireEvent.click(screen.getByText("Info"));
    expect(screen.getByText("Details here")).toBeTruthy();
  });
});

describe("Command", () => {
  it("filters items as the user types and runs the selected item", async () => {
    const onSelect = vi.fn();
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandGroup heading="Tools">
            <CommandItem onSelect={onSelect}>Thumbnail Generator</CommandItem>
            <CommandItem>Video Generator</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Search"), {
        target: { value: "thumb" },
      });
    });
    expect(screen.getByText("Thumbnail Generator")).toBeTruthy();
    expect(screen.queryByText("Video Generator")).toBeNull();

    fireEvent.click(screen.getByText("Thumbnail Generator"));
    expect(onSelect).toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Search"), {
        target: { value: "zzz" },
      });
    });
    expect(screen.getByText("No results")).toBeTruthy();
  });
});

describe("Checkbox / Switch (Radix)", () => {
  it("toggles a checkbox", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Accept" onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Accept" }));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("reflects and toggles a controlled switch", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch aria-label="Enabled" checked onCheckedChange={onCheckedChange} />,
    );
    const toggle = screen.getByRole("switch", { name: "Enabled" });

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.className).toContain("bg-[#00bbd9]");
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});

describe("CookieConsent", () => {
  it("shows the banner until a choice is stored", () => {
    render(<CookieConsent />);

    expect(screen.getByRole("dialog", { name: "Cookie consent" })).toBeTruthy();
    fireEvent.click(screen.getByText("Accept all"));

    expect(localStorage.getItem("creator_hub_cookie_consent")).toBe("granted");
    expect(screen.queryByRole("dialog", { name: "Cookie consent" })).toBeNull();
  });

  it("stores an essential-only choice", () => {
    render(<CookieConsent />);
    fireEvent.click(screen.getByText("Essential only"));
    expect(localStorage.getItem("creator_hub_cookie_consent")).toBe(
      "essential_only",
    );
  });

  it("stays hidden once the user has chosen", () => {
    localStorage.setItem("creator_hub_cookie_consent", "granted");
    render(<CookieConsent />);
    expect(screen.queryByRole("dialog", { name: "Cookie consent" })).toBeNull();
  });

  it("opens the provided policy modal", () => {
    const Modal = ({
      open,
    }: {
      open: boolean;
      onOpenChange: (o: boolean) => void;
    }) => (open ? <div>Policy text</div> : null);
    render(<CookieConsent CookiesModal={Modal} />);

    fireEvent.click(screen.getByText("Cookie policy"));

    expect(screen.getByText("Policy text")).toBeTruthy();
  });
});

describe("ToolCard", () => {
  it("opens the tool on click, Enter and Space", () => {
    const onClick = vi.fn();
    render(
      <ToolCard
        name="Thumbnails"
        description="Make thumbnails"
        onClick={onClick}
      />,
    );
    const card = screen.getByRole("button", { name: /Thumbnails/ });

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onClick).toHaveBeenCalledTimes(3);
    expect(card.getAttribute("tabindex")).toBe("0");
  });

  it("toggles favorites without opening the tool", () => {
    const onClick = vi.fn();
    const onToggleFavorite = vi.fn();
    render(
      <ToolCard
        name="Thumbnails"
        description="d"
        onClick={onClick}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    fireEvent.click(screen.getByLabelText("Add to favorites"));

    expect(onToggleFavorite).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("labels the favorite state", () => {
    render(
      <ToolCard
        name="T"
        description="d"
        isFavorite
        onToggleFavorite={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Remove from favorites")).toBeTruthy();
  });

  it("cannot be opened when inactive", () => {
    const onClick = vi.fn();
    const { container } = render(
      <ToolCard
        name="Old tool"
        description="d"
        status="inactive"
        onClick={onClick}
      />,
    );
    const card = container.firstElementChild as HTMLElement;

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onClick).not.toHaveBeenCalled();
    expect(card.getAttribute("role")).toBeNull();
    expect(screen.getByText("inactive")).toBeTruthy();
  });

  it("shows premium, category and default icon", () => {
    render(<ToolCard name="T" description="d" isPremium category="video" />);

    expect(screen.getByText("Premium")).toBeTruthy();
    expect(screen.getByText("video")).toBeTruthy();
    expect(screen.getByText("🔧")).toBeTruthy();
  });
});

describe("LoadingSpinner", () => {
  it("renders its text inside an animated glow and cleans up the animation", () => {
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(
      <LoadingSpinner size="lg" text="Rendering video..." />,
    );

    const text = screen.getByText("Rendering video...");
    expect(text.className).toContain("text-base");
    expect(text.parentElement!.style.width).toBe("300px");

    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("can render without text", () => {
    const { container } = render(<LoadingSpinner text="" />);
    expect(container.querySelector("p")).toBeNull();
  });
});
