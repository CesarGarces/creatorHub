import { describe, expect, it } from "vitest";
import {
  AnalysisParseError,
  buildAnalysisPrompt,
  formatTimestamp,
  parseAnalysisResponse,
  toSeconds,
} from "../analysis-prompt";
import { MAX_HIGHLIGHTS } from "../video-clipper.constants";

const FRAME = "data:image/jpeg;base64,AAAA";

describe("buildAnalysisPrompt", () => {
  const prompt = buildAnalysisPrompt({
    video: {
      fileName: "vlog.mp4",
      durationSec: 185.04,
      width: 1920,
      height: 1080,
    },
    frames: [
      { timestamp: 10, image: FRAME },
      { timestamp: 95.55, image: FRAME },
    ],
    platform: "tiktok",
    language: "es",
    context: "  Cooking pasta at home  ",
  });

  it("describes the video, the platform rules and the JSON contract", () => {
    expect(prompt.prompt).toContain("Duration: 185 s (03:05)");
    expect(prompt.prompt).toContain("Format: landscape 1920x1080");
    expect(prompt.prompt).toContain("Keyframes: 2, at 10s, 95.6s");
    expect(prompt.prompt).toContain(
      "Creator notes about the video: Cooking pasta at home",
    );
    expect(prompt.systemPrompt).toContain("between 5 and 90 seconds");
    expect(prompt.systemPrompt).toContain("0 <= start < end <= 185");
    expect(prompt.systemPrompt).toContain('"highlights"');
    expect(prompt.systemPrompt).toContain("Write every text field in Spanish");
  });

  it("attaches every keyframe, captioned with its timestamp, at low detail", () => {
    expect(prompt.images).toEqual([
      {
        url: FRAME,
        caption: "Keyframe 1/2 — t=10s (00:10)",
        detail: "low",
      },
      {
        url: FRAME,
        caption: "Keyframe 2/2 — t=95.6s (01:35)",
        detail: "low",
      },
    ]);
  });

  it("omits empty creator notes and reports vertical videos", () => {
    const vertical = buildAnalysisPrompt({
      video: { fileName: "a.mov", durationSec: 30, width: 1080, height: 1920 },
      frames: [{ timestamp: 1, image: FRAME }],
      platform: "youtube-shorts",
      language: "en",
      context: "   ",
    });
    expect(vertical.prompt).not.toContain("Creator notes");
    expect(vertical.prompt).toContain("vertical 1080x1920");
    expect(vertical.systemPrompt).toContain("between 5 and 60 seconds");
  });
});

describe("toSeconds / formatTimestamp", () => {
  it.each([
    [42, 42],
    ["42", 42],
    ["12.5s", 12.5],
    ["01:30", 90],
    ["1:02:05", 3725],
    ["00:10.5", 10.5],
    ["soon", NaN],
    [null, NaN],
    [Infinity, NaN],
  ])("toSeconds(%j) = %j", (input, expected) => {
    expect(toSeconds(input)).toEqual(expected);
  });

  it("formats mm:ss and h:mm:ss", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(83.9)).toBe("01:23");
    expect(formatTimestamp(3725)).toBe("1:02:05");
    expect(formatTimestamp(-3)).toBe("00:00");
  });
});

describe("parseAnalysisResponse", () => {
  const options = { durationSec: 300, platform: "youtube-shorts" as const };

  const reply = {
    summary: "A   cooking vlog.",
    contentType: "vlog",
    highlights: [
      {
        start: 120,
        end: 150,
        title: "The sauce",
        hook: "Nobody tells you this",
        reason: "Payoff",
        score: 91,
        tags: ["food"],
      },
      {
        start: "00:10",
        end: "00:40",
        title: "Intro",
        hook: "Watch",
        reason: "Strong open",
        score: 70,
      },
    ],
    hooks: [
      "Stop boiling pasta like this",
      { text: "Why chefs salt twice", style: "question" },
    ],
    titles: [
      { text: "I cooked pasta for 30 days", platform: "youtube" },
      "Pasta hack",
    ],
    hashtags: ["#pasta", "cooking tips", "#pasta", "ñoquis!"],
  };

  it("parses JSON wrapped in prose and code fences", () => {
    const raw = `Sure! Here it is:\n\`\`\`json\n${JSON.stringify(reply)}\n\`\`\`\nEnjoy.`;
    const parsed = parseAnalysisResponse(raw, options);

    expect(parsed.summary).toBe("A cooking vlog.");
    expect(parsed.contentType).toBe("vlog");
    // Sorted by time, ids in that order, mm:ss converted.
    expect(
      parsed.highlights.map((h) => [h.id, h.start, h.end, h.title]),
    ).toEqual([
      ["h1", 10, 40, "Intro"],
      ["h2", 120, 150, "The sauce"],
    ]);
    expect(parsed.highlights[1]).toMatchObject({
      hook: "Nobody tells you this",
      reason: "Payoff",
      score: 91,
      tags: ["food"],
    });
    expect(parsed.hooks).toEqual([
      { text: "Stop boiling pasta like this", style: null },
      { text: "Why chefs salt twice", style: "question" },
    ]);
    expect(parsed.titles).toEqual([
      { text: "I cooked pasta for 30 days", platform: "youtube" },
      { text: "Pasta hack", platform: null },
    ]);
    expect(parsed.hashtags).toEqual(["#pasta", "#cookingtips", "#ñoquis"]);
  });

  it("clamps clips to the video and the platform's length rules", () => {
    const parsed = parseAnalysisResponse(
      JSON.stringify({
        highlights: [
          { start: -5, end: 200, score: 80 }, // too long → cut to 60 s
          { start: 298, end: 299, score: 60 }, // too short at the end → widened backwards
          { start: 100, end: 102, score: 0.75 }, // 0–1 score scale
        ],
      }),
      options,
    );
    expect(parsed.highlights.map((h) => [h.start, h.end, h.score])).toEqual([
      [0, 60, 80],
      [100, 105, 75],
      [295, 300, 60],
    ]);
  });

  it("keeps clips of videos shorter than the platform minimum", () => {
    const parsed = parseAnalysisResponse(
      JSON.stringify({ highlights: [{ start: 0, end: 2 }] }),
      { durationSec: 3, platform: "youtube-shorts" },
    );
    expect(parsed.highlights).toMatchObject([{ start: 0, end: 3, score: 50 }]);
  });

  it("resolves overlaps: big ones keep the best clip, small ones are trimmed", () => {
    const parsed = parseAnalysisResponse(
      JSON.stringify({
        highlights: [
          { start: 10, end: 40, score: 60, title: "A" },
          { start: 12, end: 38, score: 90, title: "B" }, // mostly overlaps A, better
          { start: 50, end: 80, score: 70, title: "C" },
          { start: 75, end: 100, score: 65, title: "D" }, // small overlap → starts at 80
          { start: 101, end: 90, score: 99, title: "E" }, // end before start → dropped
        ],
      }),
      options,
    );
    expect(parsed.highlights.map((h) => [h.title, h.start, h.end])).toEqual([
      ["B", 12, 38],
      ["C", 50, 80],
      ["D", 80, 100],
    ]);
  });

  it(`keeps the ${MAX_HIGHLIGHTS} best clips, in time order`, () => {
    const highlights = Array.from({ length: 12 }, (_, i) => ({
      start: i * 20,
      end: i * 20 + 10,
      score: i, // later clips score higher
    }));
    const parsed = parseAnalysisResponse(
      JSON.stringify({ highlights }),
      options,
    );
    expect(parsed.highlights).toHaveLength(MAX_HIGHLIGHTS);
    expect(parsed.highlights[0]!.start).toBe(80);
    expect(parsed.highlights.map((h) => h.id)).toEqual(
      Array.from({ length: MAX_HIGHLIGHTS }, (_, i) => `h${i + 1}`),
    );
  });

  it("accepts alternative key names and truncates long texts", () => {
    const parsed = parseAnalysisResponse(
      JSON.stringify({
        clips: [
          {
            startTime: "0:05",
            end_time: "0:25",
            name: "x".repeat(150),
            hook_text: "Look",
            why: "Because",
            viralityScore: 140,
          },
        ],
        titles: ["", "  Same title ", "same title"],
      }),
      options,
    );
    const [clip] = parsed.highlights;
    expect(clip).toMatchObject({
      start: 5,
      end: 25,
      hook: "Look",
      reason: "Because",
      score: 100,
    });
    expect(clip!.title).toHaveLength(100);
    expect(clip!.title.endsWith("…")).toBe(true);
    expect(parsed.titles).toEqual([{ text: "Same title", platform: null }]);
  });

  it.each([
    ["no JSON at all", "I can't see the video."],
    ["broken JSON", "{ highlights: [ }"],
    ["an array instead of an object", "[1, 2]"],
    [
      "no usable highlight",
      JSON.stringify({ highlights: [{ start: "x", end: 3 }], titles: ["T"] }),
    ],
  ])("throws AnalysisParseError for %s", (_label, raw) => {
    expect(() => parseAnalysisResponse(raw, options)).toThrow(
      AnalysisParseError,
    );
  });
});
