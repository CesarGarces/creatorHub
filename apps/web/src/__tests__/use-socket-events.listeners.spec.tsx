import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

type Handler = (payload?: unknown) => void;

/** A socket with several listeners per event, like socket.io's. */
const fakeSocket = vi.hoisted(() => {
  const listeners = new Map<string, Set<Handler>>();
  return {
    listeners,
    connected: true,
    on: vi.fn((event: string, fn: Handler) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    }),
    off: vi.fn((event: string, fn?: Handler) => {
      if (fn) listeners.get(event)?.delete(fn);
      else listeners.delete(event);
    }),
    connect: () => undefined,
    emit(event: string, payload?: unknown) {
      for (const fn of [...(listeners.get(event) ?? [])]) fn(payload);
    },
    count: (event: string) => listeners.get(event)?.size ?? 0,
  };
});

vi.mock("@/lib/socket", () => ({ connectSocket: () => fakeSocket }));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { useSocketEvents } from "@/hooks/use-socket-events";
import { useCreditsStore } from "@/store/credits.store";

function Harness({ onNew }: { onNew?: (n: unknown) => void }) {
  useSocketEvents({ onNotificationNew: onNew });
  return null;
}

beforeEach(() => {
  fakeSocket.listeners.clear();
  fakeSocket.on.mockClear();
  fakeSocket.off.mockClear();
});

describe("useSocketEvents listeners", () => {
  it("keeps other listeners of the same events (e.g. a voice session's result)", () => {
    const voiceResult = vi.fn();
    fakeSocket.on("stt:result", voiceResult); // useLiveSpeechToText's
    const { unmount } = render(<Harness />);
    expect(fakeSocket.count("stt:result")).toBe(2);

    unmount();

    expect(fakeSocket.count("stt:result")).toBe(1);
    fakeSocket.emit("stt:result", { fullTranscript: "hola" });
    expect(voiceResult).toHaveBeenCalledTimes(1);
  });

  it("does not re-subscribe when the caller passes a new inline callback", () => {
    const { rerender } = render(<Harness onNew={() => {}} />);
    const subscriptions = fakeSocket.on.mock.calls.length;

    rerender(<Harness onNew={() => {}} />);
    rerender(<Harness onNew={() => {}} />);

    expect(fakeSocket.on.mock.calls.length).toBe(subscriptions);
    expect(fakeSocket.off).not.toHaveBeenCalled();
  });

  it("calls the latest notification callback", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<Harness onNew={first} />);
    rerender(<Harness onNew={latest} />);

    fakeSocket.emit("notification:new", { id: "n1" });

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith({ id: "n1" });
  });

  it("still refreshes the balance after a voice session", () => {
    const fetchBalance = vi.fn(async () => undefined);
    useCreditsStore.setState({ fetchBalance });
    render(<Harness />);
    fakeSocket.emit("stt:result", {});
    expect(fetchBalance).toHaveBeenCalledTimes(1);
  });
});
