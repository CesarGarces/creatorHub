import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ default: { get } }));

import {
  DEFAULT_STT_CREDITS_PER_MINUTE,
  __resetSttRateCache,
  fetchSttCreditsPerMinute,
  useSttCreditsPerMinute,
} from "@/components/voice-button/use-stt-rate";
import { VoiceButton } from "@/components/voice-button";

beforeEach(() => {
  get.mockReset();
  __resetSttRateCache();
});

describe("voice input price (Admin → AI Models → speech-to-text)", () => {
  it("reads the active speech-to-text model's credit cost", async () => {
    get.mockResolvedValue([
      { creditCost: 5, isActive: false },
      { creditCost: 3, isActive: true },
    ]);
    await expect(fetchSttCreditsPerMinute()).resolves.toBe(3);
    expect(get).toHaveBeenCalledWith("/ai/models", {
      params: { taskTypes: "speech-to-text" },
    });
  });

  it("allows free voice input (0 credits)", async () => {
    get.mockResolvedValue([{ creditCost: 0, isActive: true }]);
    await expect(fetchSttCreditsPerMinute()).resolves.toBe(0);
  });

  it("falls back to 1 credit/min without a configured model", async () => {
    get.mockResolvedValue([]);
    await expect(fetchSttCreditsPerMinute()).resolves.toBe(
      DEFAULT_STT_CREDITS_PER_MINUTE,
    );
    expect(DEFAULT_STT_CREDITS_PER_MINUTE).toBe(1);
  });

  it("falls back on bad data, and on errors retries next time", async () => {
    get.mockResolvedValueOnce({ nope: true });
    await expect(fetchSttCreditsPerMinute()).resolves.toBe(1);

    __resetSttRateCache();
    get.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchSttCreditsPerMinute()).resolves.toBe(1);
    get.mockResolvedValueOnce([{ creditCost: 4, isActive: true }]);
    await expect(fetchSttCreditsPerMinute()).resolves.toBe(4);
  });

  it("survives an API client that throws synchronously", async () => {
    get.mockImplementation(() => {
      throw new Error("not ready");
    });
    await expect(fetchSttCreditsPerMinute()).resolves.toBe(1);
  });

  it("asks the API once for every voice button on the page", async () => {
    get.mockResolvedValue([{ creditCost: 2, isActive: true }]);
    const a = renderHook(() => useSttCreditsPerMinute());
    const b = renderHook(() => useSttCreditsPerMinute());
    expect(a.result.current).toBe(1); // default until loaded
    await waitFor(() => expect(a.result.current).toBe(2));
    await waitFor(() => expect(b.result.current).toBe(2));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("the recording button shows the configured price", async () => {
    get.mockResolvedValue([{ creditCost: 3, isActive: true }]);
    render(<VoiceButton isListening onToggle={() => {}} />);
    expect(await screen.findByText("+3 cr/min")).toBeTruthy();
  });
});
