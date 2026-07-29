import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import {
  buildCommunitySystemPrompt,
  type StyleProfileContext,
} from "./style-prompt";

const RECENT_SAMPLES_LIMIT = 5;

/**
 * Loads everything that grounds the bot's replies in the creator's voice
 * (style profile + representative samples + custom instructions) and
 * builds the system prompt. This is the style-profile RAG — no vector
 * store, per the approved phase-1 scope.
 */
@Injectable()
export class StyleContextService {
  async buildSystemPrompt(input: {
    userId: string;
    useStyleProfile: boolean;
    systemPromptExtra?: string | null;
  }): Promise<string> {
    const { userId, useStyleProfile, systemPromptExtra } = input;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    let styleProfile: StyleProfileContext | null = null;
    let recentSamples: string[] = [];

    if (useStyleProfile) {
      const profile = await prisma.userStyleProfile.findUnique({
        where: { userId },
      });

      if (profile?.isActive) {
        styleProfile = {
          tone: profile.tone,
          vocabKeywords: profile.vocabKeywords,
          sentenceLength: profile.sentenceLength,
          emojiUsage: profile.emojiUsage,
          formalityLevel: profile.formalityLevel,
          language: profile.language,
          summary: profile.summary,
        };
      }

      const samples = await prisma.userContentSample.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: RECENT_SAMPLES_LIMIT,
        select: { content: true },
      });
      recentSamples = samples.map((s) => s.content);
    }

    return buildCommunitySystemPrompt({
      creatorName: user?.name ?? user?.email?.split("@")[0],
      styleProfile,
      systemPromptExtra,
      recentSamples,
    });
  }
}
