import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInView } from "@/hooks/use-in-view";

type Callback = (entries: { isIntersecting: boolean }[]) => void;

class ObserverMock {
  static instances: ObserverMock[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(
    public callback: Callback,
    public options: IntersectionObserverInit,
  ) {
    ObserverMock.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  ObserverMock.instances = [];
});

describe("useInView", () => {
  it("is true once the element nears the viewport, and stays true", () => {
    vi.stubGlobal("IntersectionObserver", ObserverMock);
    const { result } = renderHook(() =>
      useInView<HTMLDivElement>({ rootMargin: "200px 0px" }),
    );
    expect(result.current[1]).toBe(false);

    const el = document.createElement("div");
    act(() => result.current[0](el));
    const observer = ObserverMock.instances[0]!;
    expect(observer.observed).toEqual([el]);
    expect(observer.options.rootMargin).toBe("200px 0px");

    act(() => observer.callback([{ isIntersecting: false }]));
    expect(result.current[1]).toBe(false);

    act(() => observer.callback([{ isIntersecting: true }]));
    expect(result.current[1]).toBe(true);
    expect(observer.disconnected).toBe(true);
  });

  it("is true at once where IntersectionObserver doesn't exist", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useInView<HTMLDivElement>());

    act(() => result.current[0](document.createElement("div")));
    expect(result.current[1]).toBe(true);
  });
});
