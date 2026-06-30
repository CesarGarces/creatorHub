import { Injectable } from "@nestjs/common";
import { StyleProfileService } from "./style-profile.service";

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

@Injectable()
export class StyleInjectionService {
  constructor(private profileService: StyleProfileService) {}

  async getStylePrompt(userId: string): Promise<string> {
    const profile = await this.profileService.getByUserId(userId);

    if (!profile || !profile.isActive) {
      return "";
    }

    const keywordsStr =
      profile.vocabKeywords.length > 0
        ? profile.vocabKeywords.join(", ")
        : "none specified";

    const languageName =
      LANGUAGE_NAMES[profile.language] || profile.language.toUpperCase();

    return `USER STYLE PROFILE (apply to ALL generated content):
- Primary Language: ${languageName} (${profile.language}) — ALWAYS respond in this language
- Tone: ${profile.tone}
- Keywords: ${keywordsStr}
- Sentence length: ${profile.sentenceLength}
- Emoji usage: ${profile.emojiUsage}
- Formality: ${profile.formalityLevel}${profile.summary ? `\n- Style summary: ${profile.summary}` : ""}
IMPORTANT: Match this style strictly in your response.`;
  }
}
