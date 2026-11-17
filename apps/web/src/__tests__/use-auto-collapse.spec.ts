import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AUTO_COLLAPSE_MS, useAutoCollapse } from "@/hooks/use-auto-collapse";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useAutoCollapse", () => {
  it("starts expanded and collapses after the idle time", () => {
    const { result } = renderHook(() => useAutoCollapse());
    expect(AUTO_COLLAPSE_MS).toBe(5000);
    act(() => vi.advanceTimersByTime(AUTO_COLLAPSE_MS - 1));
    expect(result.current.collapsed).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.collapsed).toBe(true);
  });

  it("collapses at once when anything scrolls (including inner scrollers)", () => {
    const { result } = renderHook(() => useAutoCollapse());
    const main = document.createElement("main");
    document.body.appendChild(main);
    act(() => {
      main.dispatchEvent(new Event("scroll")); // does not bubble: needs capture
    });
    expect(result.current.collapsed).toBe(true);
    main.remove();
  });

  it("expands again and restarts the idle timer", () => {
    const { result } = renderHook(() => useAutoCollapse(1000));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.expand());
    expect(result.current.collapsed).toBe(false);
    act(() => vi.advanceTimersByTime(999));
    expect(result.current.collapsed).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.collapsed).toBe(true);
  });

  it("stays expanded while hovered or focused, even when the page scrolls", () => {
    const { result } = renderHook(() => useAutoCollapse(1000));
    act(() => result.current.hold("hover"));
    act(() => result.current.hold("focus"));
    act(() => {
      vi.advanceTimersByTime(5000);
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.collapsed).toBe(false);

    act(() => result.current.release("hover"));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.collapsed).toBe(false); // still focused

    act(() => result.current.release("focus"));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.collapsed).toBe(true);
  });

  it("does nothing while disabled and cleans up on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useAutoCollapse(1000, false));
    act(() => {
      vi.advanceTimersByTime(5000);
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.collapsed).toBe(false);
    unmount();

    const enabled = renderHook(() => useAutoCollapse(1000));
    enabled.unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), {
      capture: true,
    });
  });
});
