import { describe, expect, it } from "vitest";
import { chunkText } from "../ai-planner/chunking";

describe("chunkText", () => {
  it("keeps short text as one chunk and drops empty text", () => {
    expect(chunkText("  short idea  ")).toEqual(["short idea"]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("packs paragraphs up to the size and overlaps consecutive chunks", () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) =>
      `Paragraph ${i} `.repeat(20).trim(),
    );
    const chunks = chunkText(paragraphs.join("\n\n"), 500, 50);

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks)
      expect(chunk.length).toBeLessThanOrEqual(500 + 50 + 1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.startsWith(chunks[i - 1]!.slice(-50))).toBe(true);
    }
    // Nothing is lost.
    for (const p of paragraphs)
      expect(chunks.join(" ")).toContain(p.slice(0, 30));
  });

  it("splits a paragraph longer than the size on sentences, then hard", () => {
    const sentence = "This sentence is quite long indeed. ";
    const chunks = chunkText(sentence.repeat(40), 200, 20);
    expect(chunks.every((c) => c.length <= 221)).toBe(true);
    expect(chunkText("x".repeat(450), 200, 0)).toEqual([
      "x".repeat(200),
      "x".repeat(200),
      "x".repeat(50),
    ]);
  });
});
