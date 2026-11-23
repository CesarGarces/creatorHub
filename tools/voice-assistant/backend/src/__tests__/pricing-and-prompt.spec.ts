import { describe, expect, it } from "vitest";
import { replyCredits } from "../pricing";
import { buildPersonaPrompt } from "../persona-prompt";

describe("replyCredits", () => {
  const rate = 120; // credits per minute (Admin → Voice)

  it("charges 1 credit for a written reply", () => {
    expect(
      replyCredits({ hasContent: true, audioMs: 0, ttsCreditsPerMinute: rate }),
    ).toBe(1);
  });

  it("charges every started second of speech at the per-minute TTS price", () => {
    const spoken = (audioMs: number, ttsCreditsPerMinute = rate) =>
      replyCredits({ hasContent: true, audioMs, ttsCreditsPerMinute });
    expect(spoken(4_000)).toBe(8);
    expect(spoken(4_200)).toBe(10);
    expect(spoken(20_000)).toBe(40);
    expect(spoken(30_000, 1.2)).toBe(1);
  });

  it("never charges a spoken reply less than a written one", () => {
    expect(
      replyCredits({
        hasContent: true,
        audioMs: 5_000,
        ttsCreditsPerMinute: 0,
      }),
    ).toBe(1);
  });

  it("is free when nothing was written or said", () => {
    expect(
      replyCredits({
        hasContent: false,
        audioMs: 0,
        ttsCreditsPerMinute: rate,
      }),
    ).toBe(0);
  });
});

describe("buildPersonaPrompt", () => {
  const now = new Date("2026-11-27T10:00:00Z");

  it("introduces Robotina and pins the reply language", () => {
    const prompt = buildPersonaPrompt({ language: "es", spoken: true, now });
    expect(prompt).toContain("You are Robotina");
    expect(prompt).toContain("Reply ONLY in Spanish");
  });

  it("gives the user's local date, time and time zone", () => {
    expect(
      buildPersonaPrompt({
        language: "es",
        spoken: true,
        now,
        timeZone: "America/Bogota",
      }),
    ).toContain(
      "Current date and time for the user: Friday 2026-11-27, 05:00 (America/Bogota, UTC-05:00).",
    );
    expect(buildPersonaPrompt({ language: "en", spoken: true, now })).toContain(
      "Friday 2026-11-27, 10:00 (UTC, UTC+00:00)",
    );
  });

  it("lists the registered actions and how to use them", () => {
    const prompt = buildPersonaPrompt({
      language: "en",
      spoken: true,
      now,
      actions: [
        {
          name: "calendar.create_event",
          toolId: "content-planner",
          mutates: true,
          description: "Create a session.",
          parameters: [
            {
              name: "title",
              type: "string",
              required: true,
              description: "Name",
            },
            { name: "date", type: "date", required: true, description: "Day" },
            {
              name: "type",
              type: "string",
              required: false,
              enum: ["RECORDING", "OTHER"],
              description: "Kind",
            },
          ],
        },
      ],
    });
    expect(prompt).toContain(
      "- calendar.create_event (changes the user's data): Create a session.",
    );
    expect(prompt).toContain("    - title (string, required): Name");
    expect(prompt).toContain("    - date (date YYYY-MM-DD, required): Day");
    expect(prompt).toContain(
      "    - type (string, optional, one of RECORDING|OTHER): Kind",
    );
    expect(prompt).toContain("never invent a name, a date or a time");
    expect(prompt).toContain(
      '<action>{"name":"<action name>","args":{...}}</action>',
    );
    expect(prompt).toContain('"ACTION RESULT"');
    expect(prompt).toContain(
      "Saying you'll do it without writing the action does NOTHING",
    );
  });

  it("shows the tools' examples as sample exchanges", () => {
    const prompt = buildPersonaPrompt({
      language: "en",
      spoken: true,
      now,
      actions: [
        {
          name: "calendar.list_events",
          toolId: "content-planner",
          mutates: false,
          description: "Read the agenda.",
          parameters: [],
          example: {
            request: "Do I have plans on May 12?",
            args: { date: "2026-05-12" },
          },
        },
      ],
    });
    expect(prompt).toContain(
      'User: Do I have plans on May 12?\nYou: Let me check. <action>{"name":"calendar.list_events","args":{"date":"2026-05-12"}}</action>',
    );
  });

  it("without actions, she never offers to change anything", () => {
    const prompt = buildPersonaPrompt({ language: "en", spoken: true, now });
    expect(prompt).toContain("You can't change anything in the user's account");
    expect(prompt).not.toContain("<action>");
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
