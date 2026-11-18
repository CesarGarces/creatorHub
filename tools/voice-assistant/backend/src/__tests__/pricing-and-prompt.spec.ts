import { describe, expect, it } from "vitest";
import { replyCredits } from "../pricing";
import { buildPersonaPrompt } from "../persona-prompt";

describe("replyCredits", () => {
  it("charges 1 credit for a written reply", () => {
    expect(replyCredits({ hasContent: true, audioMs: 0 })).toBe(1);
  });

  it("charges 1 credit per started minute of speech", () => {
    expect(replyCredits({ hasContent: true, audioMs: 4_000 })).toBe(1);
    expect(replyCredits({ hasContent: true, audioMs: 60_000 })).toBe(1);
    expect(replyCredits({ hasContent: true, audioMs: 60_001 })).toBe(2);
    expect(replyCredits({ hasContent: true, audioMs: 150_000 })).toBe(3);
  });

  it("is free when nothing was written or said", () => {
    expect(replyCredits({ hasContent: false, audioMs: 0 })).toBe(0);
  });
});

describe("buildPersonaPrompt", () => {
  const now = new Date("2026-11-27T10:00:00Z");

  it("introduces Robotina and pins the reply language", () => {
    const prompt = buildPersonaPrompt({ language: "es", spoken: true, now });
    expect(prompt).toContain("You are Robotina");
    expect(prompt).toContain("Reply ONLY in Spanish");
    expect(prompt).toContain("Today's date: 2026-11-27.");
  });

  it("asks for plain spoken sentences in voice mode", () => {
    const prompt = buildPersonaPrompt({ language: "pt", spoken: true, now });
    expect(prompt).toContain("Brazilian Portuguese");
    expect(prompt).toContain("VOICE MODE");
    expect(prompt).toMatch(/Never use markdown/);
    expect(prompt).not.toContain("TEXT MODE");
  });

  it("allows light markdown in text mode", () => {
    const prompt = buildPersonaPrompt({ language: "en", spoken: false, now });
    expect(prompt).toContain("TEXT MODE");
    expect(prompt).not.toContain("VOICE MODE");
  });

  it("greets the user by name and lists platform tools", () => {
    const prompt = buildPersonaPrompt({
      language: "en",
      spoken: true,
      userName: "Ana",
      tools: [{ name: "Script Writer", description: "Write scripts" }],
      now,
    });
    expect(prompt).toContain("You are talking with Ana.");
    expect(prompt).toContain("- Script Writer: Write scripts");
  });

  it("leaves the tools section out when there are none", () => {
    const prompt = buildPersonaPrompt({ language: "en", spoken: true, now });
    expect(prompt).not.toContain("CREATOR HUB ---");
  });
});
