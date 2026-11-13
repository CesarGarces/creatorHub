import { vi } from "vitest";

/** Shared Next.js App Router mock; registered globally in setup.ts. */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export const navigationState = {
  pathname: "/dashboard",
  searchParams: new URLSearchParams(),
};

export function resetNavigationMock(): void {
  Object.values(routerMock).forEach((fn) => fn.mockReset());
  navigationState.pathname = "/dashboard";
  navigationState.searchParams = new URLSearchParams();
}
