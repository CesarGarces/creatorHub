import { describe, expect, it } from "vitest";
import {
  SpeechChunker,
  sentenceBoundaries,
  toSpeakableText,
} from "../speech-text";

describe("toSpeakableText", () => {
  it("removes emphasis, headings and list markers", () => {
    expect(
      toSpeakableText(
        "## Ideas\n- **Short** videos\n- _Live_ streams\n1. Post daily",
      ),
    ).toBe("Ideas. Short videos. Live streams. Post daily.");
  });

  it("reads link text, never URLs", () => {
    expect(
      toSpeakableText(
        "See [the guide](https://example.com/guide) or https://x.com/a now.",
      ),
    ).toBe("See the guide or now.");
  });

  it("skips code blocks but reads inline code", () => {
    expect(
      toSpeakableText(
        "Run `npm test` first.\n```js\nconsole.log(1)\n```\nDone!",
      ),
    ).toBe("Run npm test first. Done!");
  });

  it("drops emojis and stray marks split across chunks", () => {
    expect(toSpeakableText("Great idea 🎉🚀! **Really")).toBe(
      "Great idea! Really.",
    );
  });

  it("turns table rows into phrases", () => {
    expect(toSpeakableText("| Day | Views |\n|---|---|\n| Mon | 10 |")).toBe(
      "Day, Views. Mon, 10.",
    );
  });

  it("keeps normal sentences as they are", () => {
    expect(toSpeakableText("Hola, ¿cómo estás? Bien.")).toBe(
      "Hola, ¿cómo estás? Bien.",
    );
    expect(toSpeakableText("It costs 3.5 dollars, e.g. cheap.")).toBe(
      "It costs 3.5 dollars, e.g. cheap.",
    );
  });
});

describe("sentenceBoundaries", () => {
  it("finds sentence ends and line breaks", () => {
    const text = "Hi there! How are you? Fine.\nNext";
    const ends = sentenceBoundaries(text);
    expect(ends.map((end) => text.slice(0, end).trim())).toEqual([
      "Hi there!",
      "Hi there! How are you?",
      "Hi there! How are you? Fine.",
    ]);
  });

  it("ignores decimals, list numbers and open code fences", () => {
    expect(sentenceBoundaries("Version 3.5 is out")).toEqual([]);
    expect(sentenceBoundaries("1. First")).toEqual([]);
    expect(sentenceBoundaries("```\nfoo. bar")).toEqual([]);
  });
});

describe("SpeechChunker", () => {
  const stream = (chunker: SpeechChunker, text: string, size = 3) => {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      out.push(...chunker.push(text.slice(i, i + size)));
    }
    return out;
  };

  it("sends the first sentence as soon as it ends", () => {
    const chunker = new SpeechChunker();
    expect(chunker.push("Great question! Let me ")).toEqual([
      "Great question!",
    ]);
  });

  it("waits for a complete sentence of some length first", () => {
    const chunker = new SpeechChunker();
    expect(chunker.push("Hi! ")).toEqual([]); // too short alone
    expect(chunker.push("Nice to meet you. And")).toEqual([
      "Hi! Nice to meet you.",
    ]);
  });

  it("groups later sentences into fewer, longer chunks", () => {
    const chunker = new SpeechChunker({ minChars: 60 });
    const text =
      "Sure thing, friend. Cats sleep a lot. They also purr. Some love " +
      "water. Most do not like baths at all. The end";
    const chunks = [...stream(chunker, text), ...chunker.flush()];
    expect(chunks[0]).toBe("Sure thing, friend.");
    expect(chunks.length).toBeLessThan(6);
    expect(chunks.join(" ")).toBe(
      "Sure thing, friend. Cats sleep a lot. They also purr. Some love " +
        "water. Most do not like baths at all. The end.",
    );
    for (const chunk of chunks.slice(1, -1)) {
      expect(chunk.length).toBeGreaterThanOrEqual(60);
    }
  });

  it("cuts long runs without punctuation at a comma or space", () => {
    const chunker = new SpeechChunker({ maxChars: 50 });
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const chunks = [...stream(chunker, words, 7), ...chunker.flush()];
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(52);
    expect(chunks.join(" ").replace(/\./g, "")).toBe(words);
  });

  it("never speaks code and skips chunks with nothing to say", () => {
    const chunker = new SpeechChunker();
    const chunks = [
      ...chunker.push("Here you go: ```\nconst a = 1. b = 2.\n``` "),
      ...chunker.flush(),
    ];
    expect(chunks).toEqual(["Here you go:"]);
  });

  it("flushes the rest when the model ends", () => {
    const chunker = new SpeechChunker();
    chunker.push("Bye for now");
    expect(chunker.flush()).toEqual(["Bye for now."]);
    expect(chunker.flush()).toEqual([]);
  });
});
