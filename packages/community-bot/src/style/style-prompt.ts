/**
 * Builder for the system prompt that makes community replies sound like
 * the creator. This is the platform's style-profile "RAG": the creator's
 * UserStyleProfile (+ optional recent content samples and extra
 * instructions) is injected as context — no vector store involved.
 *
 * Kept as a pure, dependency-free function so both the API (preview /
 * playground) and the community-worker (live replies) build the exact
 * same prompt.
 */

export interface StyleProfileContext {
  tone: string;
  vocabKeywords: string[];
  sentenceLength: string;
  emojiUsage: string;
  formalityLevel: string;
  language: string;
  summary?: string | null;
}

export interface CommunityPromptInput {
  creatorName?: string | null;
  styleProfile?: StyleProfileContext | null;
  /** Creator-provided extra instructions for the bot */
  systemPromptExtra?: string | null;
  /** Representative creator samples for few-shot grounding */
  recentSamples?: string[];
  maxReplyChars?: number;
}

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
};

const DEFAULT_MAX_REPLY_CHARS = 900;

export function buildCommunitySystemPrompt(
  input: CommunityPromptInput,
): string {
  const {
    creatorName,
    styleProfile,
    systemPromptExtra,
    recentSamples,
    maxReplyChars = DEFAULT_MAX_REPLY_CHARS,
  } = input;

  const parts: string[] = [];

  parts.push(
    [
      `You are the community assistant of ${creatorName || "a content creator"}.`,
      "You reply to messages from the creator's community on their behalf,",
      "faithfully matching the creator's voice and personality.",
      "Never invent facts about the creator (schedule, prices, private info).",
      "If you don't know something, say the creator will get back to them soon.",
      `Keep every reply under ${maxReplyChars} characters, conversational and natural — this is a chat, not an email.`,
    ].join(" "),
  );

  if (styleProfile) {
    const keywords =
      styleProfile.vocabKeywords.length > 0
        ? styleProfile.vocabKeywords.join(", ")
        : "none specified";
    const languageName =
      LANGUAGE_NAMES[styleProfile.language] ||
      styleProfile.language.toUpperCase();

    parts.push(
      [
        "CREATOR STYLE PROFILE (apply strictly to every reply):",
        `- Primary language: ${languageName} (${styleProfile.language}) — ALWAYS reply in this language unless the fan explicitly writes in another one`,
        `- Tone: ${styleProfile.tone}`,
        `- Signature vocabulary: ${keywords}`,
        `- Sentence length: ${styleProfile.sentenceLength}`,
        `- Emoji usage: ${styleProfile.emojiUsage}`,
        `- Formality: ${styleProfile.formalityLevel}`,
        styleProfile.summary
          ? `- Style summary: ${styleProfile.summary}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (recentSamples && recentSamples.length > 0) {
    const samples = recentSamples
      .slice(0, 5)
      .map((sample, i) => `${i + 1}. "${sample}"`)
      .join("\n");
    parts.push(
      [
        "REAL EXAMPLES of how the creator writes (match this voice):",
        samples,
      ].join("\n"),
    );
  }

  if (systemPromptExtra?.trim()) {
    parts.push(
      `ADDITIONAL INSTRUCTIONS FROM THE CREATOR:\n${systemPromptExtra.trim()}`,
    );
  }

  return parts.join("\n\n");
}
