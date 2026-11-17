import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  ChatLauncher,
  LAUNCHER_TOOLTIP_DELAY_MS,
} from "@/components/chat/chat-launcher";
import { AUTO_COLLAPSE_MS } from "@/hooks/use-auto-collapse";

const button = () => screen.getByRole("button", { name: "Open chat" });
const state = () => button().dataset.state;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ChatLauncher", () => {
  it("shows the hint, then tucks into an edge tab after the idle time", () => {
    render(<ChatLauncher onOpen={vi.fn()} />);
    expect(state()).toBe("expanded");
    act(() => vi.advanceTimersByTime(LAUNCHER_TOOLTIP_DELAY_MS));
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Do you need help?",
    );

    act(() => vi.advanceTimersByTime(AUTO_COLLAPSE_MS));
    expect(state()).toBe("collapsed");
    expect(screen.queryByRole("tooltip")).toBeNull();
    // The pill slides (translate) — the fixed slot keeps its size: no layout shift.
    const pill = button().firstElementChild as HTMLElement;
    expect(pill.className).toContain("translate-x-7");
    expect(button().className).toContain("h-14");

    // The hint never comes back once the launcher has collapsed.
    fireEvent.pointerEnter(button(), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(LAUNCHER_TOOLTIP_DELAY_MS * 2));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("collapses while the page scrolls and expands on hover; a mouse click opens the chat", () => {
    const onOpen = vi.fn();
    render(<ChatLauncher onOpen={onOpen} />);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(state()).toBe("collapsed");

    fireEvent.pointerEnter(button(), { pointerType: "mouse" });
    expect(state()).toBe("expanded");
    act(() => vi.advanceTimersByTime(AUTO_COLLAPSE_MS * 2));
    expect(state()).toBe("expanded"); // held while hovered

    fireEvent.pointerDown(button(), { pointerType: "mouse" });
    fireEvent.click(button());
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.pointerLeave(button(), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(AUTO_COLLAPSE_MS));
    expect(state()).toBe("collapsed");
  });

  it("on touch, the first tap on the tab expands it and the second opens the chat", () => {
    const onOpen = vi.fn();
    render(<ChatLauncher onOpen={onOpen} />);
    act(() => vi.advanceTimersByTime(AUTO_COLLAPSE_MS));
    expect(state()).toBe("collapsed");

    fireEvent.pointerDown(button(), { pointerType: "touch" });
    fireEvent.click(button());
    expect(onOpen).not.toHaveBeenCalled();
    expect(state()).toBe("expanded");

    fireEvent.pointerDown(button(), { pointerType: "touch" });
    fireEvent.click(button());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("expands on keyboard focus, and Enter/assistive activation opens directly", () => {
    const onOpen = vi.fn();
    render(<ChatLauncher onOpen={onOpen} />);
    act(() => vi.advanceTimersByTime(AUTO_COLLAPSE_MS));
    act(() => button().focus());
    expect(state()).toBe("expanded");
    fireEvent.click(button()); // keyboard activation: no pointerdown
    expect(onOpen).toHaveBeenCalledTimes(1);

    act(() => button().blur());
    act(() => vi.advanceTimersByTime(AUTO_COLLAPSE_MS));
    expect(state()).toBe("collapsed");
  });

  it("never shows the hint when asked not to", () => {
    render(<ChatLauncher onOpen={vi.fn()} hideTooltip />);
    act(() => vi.advanceTimersByTime(LAUNCHER_TOOLTIP_DELAY_MS * 2));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
