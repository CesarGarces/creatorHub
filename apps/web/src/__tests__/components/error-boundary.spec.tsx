import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/error-boundary";

function Boom(): never {
  throw new Error("render exploded");
}

describe("ErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs caught render errors; keep test output clean.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeTruthy();
  });

  it("shows the default fallback when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeTruthy();
  });

  it("shows a custom fallback and logs the error", () => {
    render(
      <ErrorBoundary fallback={<p>custom fallback</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText("custom fallback")).toBeTruthy();
    expect(consoleError).toHaveBeenCalledWith(
      "Chat widget error:",
      expect.objectContaining({ message: "render exploded" }),
      expect.anything(),
    );
  });

  it("isolates failures to the wrapped subtree", () => {
    render(
      <div>
        <p>sibling still renders</p>
        <ErrorBoundary fallback={<p>fallback</p>}>
          <Boom />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText("sibling still renders")).toBeTruthy();
    expect(screen.getByText("fallback")).toBeTruthy();
  });
});
