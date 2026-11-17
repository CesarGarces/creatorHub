import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { routerMock } from "./mocks/next-navigation";

function Harness({
  active,
  onLeave,
}: {
  active: boolean;
  onLeave: () => void;
}) {
  const guard = useLeaveGuard({ active, onLeave });
  return (
    <div>
      <a href="/dashboard">Dashboard</a>
      <a href="/tools?tab=video#top">Tools</a>
      <a href="/dashboard" target="_blank">
        New tab
      </a>
      <a href="https://example.com/docs">External</a>
      <a href="#clips">Same page</a>
      <p data-testid="pending">{guard.pendingHref ?? "none"}</p>
      <button onClick={guard.confirmLeave}>Leave</button>
      <button onClick={guard.cancelLeave}>Stay</button>
    </div>
  );
}

function fireBeforeUnload() {
  const event = new Event("beforeunload", {
    cancelable: true,
  }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => vi.clearAllMocks());

describe("useLeaveGuard", () => {
  it("asks the browser to confirm refresh/close only while active", () => {
    const onLeave = vi.fn();
    const { rerender } = render(<Harness active={false} onLeave={onLeave} />);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);

    rerender(<Harness active onLeave={onLeave} />);
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    rerender(<Harness active={false} onLeave={onLeave} />);
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("runs onLeave once the page really unloads (prompt accepted)", () => {
    const onLeave = vi.fn();
    render(<Harness active onLeave={onLeave} />);
    fireBeforeUnload();
    expect(onLeave).not.toHaveBeenCalled(); // the user may still cancel
    window.dispatchEvent(new Event("pagehide"));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("holds in-app links for confirmation, then leaves or stays", () => {
    const onLeave = vi.fn();
    render(<Harness active onLeave={onLeave} />);

    const click = fireEvent.click(screen.getByText("Tools"));
    expect(click).toBe(false); // default prevented: no navigation yet
    expect(screen.getByTestId("pending").textContent).toBe(
      "/tools?tab=video#top",
    );

    fireEvent.click(screen.getByText("Stay"));
    expect(screen.getByTestId("pending").textContent).toBe("none");
    expect(routerMock.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Dashboard"));
    act(() => {
      fireEvent.click(screen.getByText("Leave"));
    });
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith("/dashboard");
    expect(screen.getByTestId("pending").textContent).toBe("none");
  });

  it("lets new tabs, modified clicks, other sites and same-page anchors through", () => {
    render(<Harness active onLeave={vi.fn()} />);
    fireEvent.click(screen.getByText("New tab"));
    fireEvent.click(screen.getByText("Dashboard"), { ctrlKey: true });
    fireEvent.click(screen.getByText("Dashboard"), { button: 1 });
    fireEvent.click(screen.getByText("External"));
    fireEvent.click(screen.getByText("Same page"));
    expect(screen.getByTestId("pending").textContent).toBe("none");
  });

  it("does not intercept links when inactive", () => {
    render(<Harness active={false} onLeave={vi.fn()} />);
    fireEvent.click(screen.getByText("Dashboard"));
    expect(screen.getByTestId("pending").textContent).toBe("none");
  });
});
