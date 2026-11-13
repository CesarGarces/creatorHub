/**
 * Global test setup (vitest `setupFiles`).
 *
 * 1. Browser APIs jsdom does not implement but our UI dependencies
 *    (cmdk, Radix) call during render.
 * 2. A shared Next.js App Router mock — useRouter()/usePathname() throw
 *    outside a mounted Next app. Assert on `routerMock` from ./mocks.
 */
import { beforeEach, vi } from "vitest";
import { resetNavigationMock } from "./mocks/next-navigation";

// ─── jsdom gaps ────────────────────────────────────────────────────────

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined") {
  if (!("ResizeObserver" in globalThis)) {
    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ResizeObserverStub,
    });
  }

  // jsdom 22 has no PointerEvent; without it pointer events lose clientX/Y.
  if (!("PointerEvent" in globalThis)) {
    class PointerEventStub extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    Object.defineProperty(globalThis, "PointerEvent", {
      writable: true,
      configurable: true,
      value: PointerEventStub,
    });
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => {};
  }

  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
}

// ─── Next.js App Router ────────────────────────────────────────────────

vi.mock("next/navigation", async () => {
  const { routerMock, navigationState } =
    await import("./mocks/next-navigation");
  return {
    useRouter: () => routerMock,
    usePathname: () => navigationState.pathname,
    useSearchParams: () => navigationState.searchParams,
    redirect: vi.fn(),
    notFound: vi.fn(),
  };
});

beforeEach(() => resetNavigationMock());
