import { TTS_MAX_CHARS_PER_REQUEST } from "@creator-hub/shared-types";

/**
 * From streamed model text to what Robotina says out loud.
 *
 * - `toSpeakableText()` strips what a voice shouldn't read (markdown marks,
 *   code, links' URLs, emojis) and turns list/heading lines into sentences.
 * - `SpeechChunker` cuts the text as it streams: the first sentence goes to
 *   Aura-2 as soon as it's complete (she starts talking while the model is
 *   still writing), later ones are grouped into chunks of a few sentences
 *   (fewer requests, more natural intonation).
 */

/** Markdown/plain text → text for a voice. */
export function toSpeakableText(input: string): string {
  let text = input;

  // Code: fenced blocks are skipped (even unterminated), inline code is read.
  text = text.replace(/```[\s\S]*?(```|$)/g, " ");
  text = text.replace(/`([^`\n]*)`/g, "$1");

  // Images and links keep their text, URLs are never read.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/<?https?:\/\/[^\s>)]+>?/g, "");

  // Line-level markdown: headings, quotes, list markers, rules, tables.
  text = text
    .split("\n")
    .map((line) => {
      let l = line.trim();
      if (/^([-*_]\s*){3,}$/.test(l)) return "";
      if (/^\|?\s*:?-{2,}/.test(l)) return ""; // table separator row
      l = l.replace(/^#{1,6}\s+/, "");
      l = l.replace(/^>\s?/, "");
      l = l.replace(/^([-*+•]|\d{1,3}[.)])\s+/, "");
      l = l.replace(/\s*\|\s*/g, ", ").replace(/^,\s*|,\s*$/g, "");
      // A line without final punctuation is still a sentence when spoken.
      if (l && !/[.!?…:;,]$/.test(l)) l += ".";
      return l;
    })
    .filter(Boolean)
    .join(" ");

  // Emphasis and leftovers of marks split across chunks.
  text = text.replace(/(\*\*|__)(.+?)\1/g, "$2");
  text = text.replace(
    /(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,!?:;]|$)/g,
    "$1$2",
  );
  text = text.replace(/~~(.+?)~~/g, "$1");
  text = text.replace(/[*`~]+/g, "");
  text = text.replace(/(^|\s)_+|_+(\s|$)/g, "$1$2");

  // Emojis and pictographs (the voice would spell them out or skip oddly).
  text = text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "");

  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

export interface SpeechChunkerOptions {
  /** The first chunk is sent once a sentence ends past this length. */
  firstMinChars?: number;
  /** Later chunks group sentences up to at least this length. */
  minChars?: number;
  /** Never wait for more than this: cut at a comma/space instead. */
  maxChars?: number;
}

const DEFAULTS: Required<SpeechChunkerOptions> = {
  firstMinChars: 12,
  minChars: 140,
  maxChars: 400,
};

/**
 * End positions (exclusive) of sentences in `text`: after . ! ? … (and
 * closing quotes/brackets) followed by whitespace, or at a line break.
 * "3.5", "1. item" and open code fences are not sentence ends.
 */
export function sentenceBoundaries(text: string): number[] {
  const ends: number[] = [];
  const pattern = /([.!?…。！？]+["'”’)\]]*)(?=\s)|\n+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const end = match.index + match[0].length;
    const before = text.slice(0, match.index);
    // "1." / "12)" list numbers at the start of a line.
    if (match[1] && /(^|\n)\s*\d{1,3}$/.test(before)) continue;
    // Inside an open code fence.
    if ((text.slice(0, end).match(/```/g)?.length ?? 0) % 2 === 1) continue;
    // "Fine.\n": the line break ends the same sentence, not a new one.
    const previous = ends[ends.length - 1] ?? 0;
    if (!text.slice(previous, end).trim()) continue;
    ends.push(end);
  }
  return ends;
}

export class SpeechChunker {
  private buffer = "";
  private chunks = 0;
  private readonly options: Required<SpeechChunkerOptions>;

  constructor(options: SpeechChunkerOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.options.maxChars = Math.min(
      this.options.maxChars,
      TTS_MAX_CHARS_PER_REQUEST,
    );
  }

  /** Adds streamed text; returns the chunks ready to be spoken. */
  push(delta: string): string[] {
    this.buffer += delta;
    const ready: string[] = [];
    for (;;) {
      const cut = this.nextCut();
      if (cut === null) break;
      const chunk = this.take(cut);
      if (chunk) ready.push(chunk);
    }
    return ready;
  }

  /** The rest of the text, once the model has finished. */
  flush(): string[] {
    const ready: string[] = [];
    while (this.buffer.trim()) {
      const cut =
        this.buffer.length > this.options.maxChars
          ? this.forcedCut(this.buffer)
          : this.buffer.length;
      const chunk = this.take(cut);
      if (chunk) ready.push(chunk);
    }
    this.buffer = "";
    return ready;
  }

  private nextCut(): number | null {
    const min =
      this.chunks === 0 ? this.options.firstMinChars : this.options.minChars;
    const ends = sentenceBoundaries(this.buffer);
    const enough = ends.filter(
      (end) => this.buffer.slice(0, end).trim().length >= min,
    );
    if (enough.length > 0) {
      if (this.chunks === 0) return enough[0]!; // talk as soon as possible
      const fitting = enough.filter((end) => end <= this.options.maxChars);
      return fitting.length > 0 ? fitting[fitting.length - 1]! : enough[0]!;
    }
    if (this.buffer.length > this.options.maxChars) {
      return this.forcedCut(this.buffer);
    }
    return null;
  }

  /** Where to cut a long run without sentence ends: a comma, else a space. */
  private forcedCut(text: string): number {
    const max = this.options.maxChars;
    const window = text.slice(0, max);
    const comma = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "));
    if (comma > max / 2) return comma + 1;
    const space = window.lastIndexOf(" ");
    return space > max / 2 ? space : max;
  }

  private take(cut: number): string {
    const raw = this.buffer.slice(0, cut);
    this.buffer = this.buffer.slice(cut);
    const spoken = toSpeakableText(raw);
    if (spoken) this.chunks += 1;
    return spoken;
  }
}
