import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";

const stt = vi.hoisted(() => ({
  options: null as null | {
    language?: string;
    onPartialTranscript: (text: string, isFinal: boolean) => void;
    onUtteranceEnd: () => void;
    onResult: (t: string, d: number, c: number) => void;
    onError: (e: string) => void;
  },
  startListening: vi.fn(async () => {}),
  stopListening: vi.fn(),
  isSupported: true,
}));

vi.mock("@/hooks/use-live-speech-to-text", () => ({
  useLiveSpeechToText: (options: NonNullable<typeof stt.options>) => {
    stt.options = options;
    return {
      startListening: stt.startListening,
      stopListening: stt.stopListening,
      isListening: false,
      isSupported: stt.isSupported,
    };
  },
}));

import { VoiceButton, useVoiceButton } from "@/components/voice-button";

describe("VoiceButton", () => {
  it("renders nothing when voice input is unsupported", () => {
    const { container } = render(<VoiceButton isSupported={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the idle label and calls onToggle", () => {
    const onToggle = vi.fn();
    render(<VoiceButton onToggle={onToggle} label="Dictate" />);

    const button = screen.getByTitle("Start voice input");
    expect(button.textContent).toContain("Dictate");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows the listening state with the credit cost", () => {
    render(<VoiceButton isListening />);

    const button = screen.getByTitle("Stop recording");
    expect(button.textContent).toContain("Listening...");
    expect(button.textContent).toContain("+1 cr/min");
  });

  it("hides text and credits in the icon-only variant", () => {
    render(<VoiceButton variant="icon" isListening label="Voice" />);

    const button = screen.getByTitle("Stop recording");
    expect(button.textContent).toBe("");
  });

  it("can hide the credit badge", () => {
    render(<VoiceButton isListening showCredits={false} />);
    expect(screen.getByTitle("Stop recording").textContent).not.toContain(
      "cr/min",
    );
  });

  it("does not fire when disabled", () => {
    const onToggle = vi.fn();
    render(<VoiceButton onToggle={onToggle} disabled />);

    const button = screen.getByTitle("Start voice input") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("useVoiceButton", () => {
  const play = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    stt.options = null;
    vi.stubGlobal(
      "Audio",
      vi.fn(function (this: { play: typeof play }) {
        this.play = play;
      }),
    );
  });

  it("starts listening, plays the start sound and reports state immediately", async () => {
    const { result } = renderHook(() => useVoiceButton({ language: "es" }));

    await act(() => result.current.toggleMic());

    expect(stt.options?.language).toBe("es");
    expect(stt.startListening).toHaveBeenCalled();
    expect(Audio).toHaveBeenCalledWith("/Voice_record_start.mp3");
    expect(result.current.isListening).toBe(true);
    expect(result.current.creditsPerMinute).toBe(1);
  });

  it("stops listening on the second toggle", async () => {
    const { result } = renderHook(() => useVoiceButton());

    await act(() => result.current.toggleMic());
    await act(() => result.current.toggleMic());

    expect(stt.stopListening).toHaveBeenCalled();
    expect(Audio).toHaveBeenLastCalledWith("/Voice_record_end.mp3");
    expect(result.current.isListening).toBe(false);
  });

  it("can run silently", async () => {
    const { result } = renderHook(() => useVoiceButton({ playSounds: false }));

    await act(() => result.current.startListening());

    expect(Audio).not.toHaveBeenCalled();
  });

  it("forwards transcripts and resets state when a result arrives", async () => {
    const onPartialTranscript = vi.fn();
    const onResult = vi.fn();
    const setExternalListening = vi.fn();
    const { result } = renderHook(() =>
      useVoiceButton({ onPartialTranscript, onResult, setExternalListening }),
    );

    await act(() => result.current.startListening());
    act(() => stt.options!.onPartialTranscript("hello", false));
    act(() => stt.options!.onResult("hello world", 4200, 1));

    expect(onPartialTranscript).toHaveBeenCalledWith("hello", false);
    expect(onResult).toHaveBeenCalledWith("hello world", 4200, 1);
    expect(setExternalListening).toHaveBeenLastCalledWith(false);
    expect(result.current.isListening).toBe(false);
  });

  it("resets state and reports errors", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useVoiceButton({ onError }));

    await act(() => result.current.startListening());
    act(() => stt.options!.onError("Microphone permission denied"));

    expect(onError).toHaveBeenCalledWith("Microphone permission denied");
    expect(result.current.isListening).toBe(false);
  });

  it("prefers external listening state when provided", () => {
    const { result } = renderHook(() =>
      useVoiceButton({ externalIsListening: true }),
    );
    expect(result.current.isListening).toBe(true);
  });
});
