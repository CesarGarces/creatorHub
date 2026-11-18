import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  readPreferences,
  writePreferences,
} from "../preferences";

beforeEach(() => localStorage.clear());

describe("Robotina preferences", () => {
  it("defaults to the shared model settings and conversation mode on", () => {
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES.handsFree).toBe(true);
    expect(DEFAULT_PREFERENCES.settings.model).toBe(
      "deepseek-ai/DeepSeek-V4-Flash",
    );
  });

  it("round-trips through localStorage", () => {
    const prefs = {
      settings: {
        model: "openai/gpt-4o-mini",
        temperature: 0.3,
        maxTokens: 500,
      },
      handsFree: false,
    };
    writePreferences(prefs);
    expect(readPreferences()).toEqual(prefs);
  });

  it("repairs bad values field by field", () => {
    expect(
      normalizePreferences({
        settings: { model: "", temperature: 7, maxTokens: "lots" },
        handsFree: "yes",
      }),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences("nope")).toEqual(DEFAULT_PREFERENCES);
  });

  it("survives broken storage", () => {
    localStorage.setItem("creator_hub.voice_assistant.prefs", "{broken");
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});
