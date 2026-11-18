import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnDetector } from "../turn-detector";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("TurnDetector", () => {
  it("ends the turn a moment after the last final phrase", () => {
    const onEnd = vi.fn();
    const turn = new TurnDetector(onEnd, { afterFinalMs: 1000 });
    turn.start();
    turn.transcript("Hola", false);
    turn.transcript("Hola Robotina", true);
    vi.advanceTimersByTime(999);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onEnd).toHaveBeenCalledWith("speech");
    expect(turn.heardSpeech).toBe(true);
  });

  it("keeps listening while the user goes on talking", () => {
    const onEnd = vi.fn();
    const turn = new TurnDetector(onEnd, { afterFinalMs: 1000 });
    turn.start();
    turn.transcript("First part.", true);
    vi.advanceTimersByTime(800);
    turn.transcript("and then", false); // still talking
    vi.advanceTimersByTime(1500);
    expect(onEnd).not.toHaveBeenCalled();
    turn.transcript("and then more.", true);
    vi.advanceTimersByTime(1000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("waits 3 s by default, so the user can pause to think", () => {
    const onEnd = vi.fn();
    const turn = new TurnDetector(onEnd);
    turn.start();
    turn.transcript("I was thinking about…", true);
    vi.advanceTimersByTime(2900);
    expect(onEnd).not.toHaveBeenCalled();
    turn.transcript("a video about cats", false); // goes on talking
    vi.advanceTimersByTime(2900);
    turn.transcript("a video about cats.", true);
    vi.advanceTimersByTime(2999);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onEnd).toHaveBeenCalledWith("speech");
  });

  it("Deepgram's utterance end doesn't cut the pause after a final phrase short", () => {
    const onEnd = vi.fn();
    const turn = new TurnDetector(onEnd);
    turn.start();
    turn.transcript("Let me think.", true);
    vi.advanceTimersByTime(2700);
    turn.utteranceEnd(); // ~3 s after the last word
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("ends at Deepgram's utterance end, only after speech", () => {
    const onEnd = vi.fn();
    const turn = new TurnDetector(onEnd);
    turn.start();
    turn.utteranceEnd();
    expect(onEnd).not.toHaveBeenCalled();
    turn.transcript("hi", false);
    turn.utteranceEnd();
    expect(onEnd).toHaveBeenCalledWith("speech");
  });

  it("gives up after a long silence", () => {
    const onEnd = vi.fn();
    const turn = new TurnDetector(onEnd, { noSpeechMs: 5000 });
    turn.start();
    turn.transcript("   ", false); // noise, no words
    vi.advanceTimersByTime(5000);
    expect(onEnd).toHaveBeenCalledWith("silence");
    expect(turn.heardSpeech).toBe(false);
  });

  it("does nothing once stopped", () => {
    const onEnd = vi.fn();
    const turn = new TurnDetector(onEnd, { afterFinalMs: 10 });
    turn.start();
    turn.transcript("hello.", true);
    turn.stop();
    vi.advanceTimersByTime(10_000);
    turn.transcript("late", true);
    vi.advanceTimersByTime(10_000);
    expect(onEnd).not.toHaveBeenCalled();
  });
});
