import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMinuteClock } from "@/hooks/use-minute-clock";

afterEach(() => vi.useRealTimers());

describe("useMinuteClock", () => {
  it("ticks at the start of every minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 23, 58, 40));
    const { result } = renderHook(() => useMinuteClock());
    expect(result.current.getMinutes()).toBe(58);

    act(() => vi.advanceTimersByTime(19_000)); // still 23:58:59
    expect(result.current.getMinutes()).toBe(58);

    act(() => vi.advanceTimersByTime(1_000)); // 23:59:00
    expect(result.current.getMinutes()).toBe(59);

    act(() => vi.advanceTimersByTime(60_000)); // next day
    expect(result.current.getDate()).toBe(18);
    expect(result.current.getHours()).toBe(0);
  });

  it("stops ticking when unmounted", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useMinuteClock());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
