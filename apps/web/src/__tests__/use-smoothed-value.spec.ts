import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSmoothedValue } from "@/hooks/use-smoothed-value";

const FRAME = 1000 / 60;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useSmoothedValue", () => {
  it("starts on the first target, then glides to new targets at a medium speed", () => {
    const { result, rerender } = renderHook(
      ({ target }) => useSmoothedValue(target),
      {
        initialProps: { target: 10 as number | null },
      },
    );
    expect(result.current).toBe(10);

    rerender({ target: 20 });
    expect(result.current).toBe(10); // not a jump
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      act(() => vi.advanceTimersByTime(FRAME));
      seen.push(result.current!);
    }
    // Moves every frame, always toward the target, fast at first then easing.
    expect(seen.every((v, i) => v > (seen[i - 1] ?? 10) && v < 20)).toBe(true);
    expect(seen[0]! - 10).toBeGreaterThan(seen[5]! - seen[4]!);
    expect(seen[0]).toBeCloseTo(12.5, 0); // ~25% of the way per frame

    act(() => vi.advanceTimersByTime(FRAME * 40));
    expect(result.current).toBe(20); // lands exactly
  });

  it("covers the same distance per second at 60 Hz and at 30 Hz", () => {
    const after200ms = () => {
      const { result, rerender, unmount } = renderHook(
        ({ target }) => useSmoothedValue(target),
        { initialProps: { target: 0 as number | null } },
      );
      rerender({ target: 100 });
      act(() => vi.advanceTimersByTime(200));
      const value = result.current!;
      unmount();
      return value;
    };
    const at60 = after200ms(); // fake rAF: one frame every 16 ms

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 2 * FRAME),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    const at30 = after200ms();

    expect(at60).toBeGreaterThan(90);
    expect(Math.abs(at60 - at30)).toBeLessThan(3);
  });

  it("resets with null and jumps at once for reduced-motion users", () => {
    const { result, rerender } = renderHook(
      ({ target }) => useSmoothedValue(target),
      {
        initialProps: { target: 5 as number | null },
      },
    );
    rerender({ target: null });
    expect(result.current).toBeNull();
    rerender({ target: 50 });
    expect(result.current).toBe(50); // first value after a reset: no glide

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    rerender({ target: 80 });
    expect(result.current).toBe(80);
  });
});
