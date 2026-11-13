import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Avatar,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CreditDisplay,
  EmptyState,
  Input,
  Separator,
  Skeleton,
  Textarea,
  Tooltip,
  cn,
} from "../index";

describe("cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", false && "hidden", "px-4")).toBe("py-1 px-4");
    expect(cn("text-sm", { "font-bold": true, italic: false })).toBe(
      "text-sm font-bold",
    );
  });
});

describe("Button", () => {
  it("renders a primary, medium button by default", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });

    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("h-10");
  });

  it("applies variants and sizes", () => {
    render(
      <Button variant="danger" size="sm">
        Delete
      </Button>,
    );
    const className = screen.getByRole("button").className;
    expect(className).toContain("bg-error");
    expect(className).toContain("h-8");
  });

  it("is disabled and shows a spinner while loading", () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Pay
      </Button>,
    );
    const button = screen.getByRole("button") as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards refs and native props", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} type="submit" aria-label="Submit form">
        Go
      </Button>,
    );
    expect(ref.current?.type).toBe("submit");
    expect(screen.getByLabelText("Submit form")).toBe(ref.current);
  });

  it("exposes buttonVariants for link-styled elements", () => {
    expect(buttonVariants({ variant: "link" })).toContain("underline-offset-4");
  });
});

describe("Badge", () => {
  it.each([
    ["primary", "text-primary"],
    ["error", "text-error"],
    ["warning", "text-warning"],
  ] as const)("renders the %s variant", (variant, expected) => {
    render(<Badge variant={variant}>Tag</Badge>);
    expect(screen.getByText("Tag").className).toContain(expected);
  });
});

describe("Card", () => {
  it("composes header, title, description, content and footer", () => {
    render(
      <Card data-testid="card" className="extra">
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>Monthly</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId("card").className).toContain("extra");
    expect(screen.getByRole("heading", { name: "Plan" }).tagName).toBe("H3");
    expect(screen.getByText("Monthly")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
  });
});

describe("Input / Textarea", () => {
  it("links the label when an id is given and shows errors", () => {
    render(<Input id="email" label="Email" error="Required" />);

    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.className).toContain("border-error");
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("forwards changes and refs", () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea id="bio" label="Bio" ref={ref} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "hi" } });

    expect(onChange).toHaveBeenCalled();
    expect(ref.current?.value).toBe("hi");
  });

  it("renders without a label", () => {
    const { container } = render(<Input placeholder="Search" />);
    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByPlaceholderText("Search")).toBeTruthy();
  });
});

describe("Avatar", () => {
  it("renders an image when a source is given", () => {
    render(<Avatar src="/me.png" name="Ana Diaz" />);
    expect((screen.getByRole("img") as HTMLImageElement).alt).toBe("Ana Diaz");
  });

  it.each([
    ["Ana Diaz", "AD"],
    ["cher", "C"],
    ["Ana Maria Diaz", "AM"],
  ])("shows initials for %j", (name, initials) => {
    render(<Avatar name={name} />);
    expect(screen.getByText(initials)).toBeTruthy();
  });

  it("shows a placeholder without a name", () => {
    render(<Avatar />);
    expect(screen.getByText("?")).toBeTruthy();
  });
});

describe("CreditDisplay", () => {
  it.each([
    [50, "text-error"],
    [250, "text-warning"],
    [5000, "text-secondary"],
  ])("colors a balance of %d", (balance, color) => {
    render(<CreditDisplay balance={balance} />);
    const label = screen.getByText(`${balance.toLocaleString()} credits`);
    expect(label.parentElement!.className).toContain(color);
  });
});

describe("EmptyState", () => {
  it("renders an action only when both label and handler are given", () => {
    const onAction = vi.fn();
    const { rerender } = render(
      <EmptyState
        icon="📭"
        title="Nothing here"
        description="Add one"
        actionLabel="Create"
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByText("Create"));
    expect(onAction).toHaveBeenCalled();
    expect(screen.getByText("📭")).toBeTruthy();

    rerender(<EmptyState title="Nothing here" actionLabel="Create" />);
    expect(screen.queryByText("Create")).toBeNull();
  });
});

describe("Tooltip / Skeleton / Separator", () => {
  it("renders tooltip content positioned on the requested side", () => {
    render(
      <Tooltip content="Dashboard" side="right">
        <button type="button">D</button>
      </Tooltip>,
    );
    expect(screen.getByText("Dashboard").className).toContain("left-full");
  });

  it("renders a skeleton placeholder and an accessible separator", () => {
    const { container } = render(
      <>
        <Skeleton className="h-4" />
        <Separator orientation="vertical" decorative={false} />
      </>,
    );

    expect(container.querySelector(".h-4")).not.toBeNull();
    expect(screen.getByRole("separator").getAttribute("aria-orientation")).toBe(
      "vertical",
    );
  });
});
