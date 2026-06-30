import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import type { StyleAnalysisResult } from "../interfaces/style-analysis-result.interface";
import type { UpdateStyleProfileDto } from "../dto/update-style-profile.dto";

@Injectable()
export class StyleProfileService {
  private logger = new Logger("StyleProfileService");

  async getByUserId(userId: string) {
    return prisma.userStyleProfile.findUnique({
      where: { userId },
    });
  }

  async upsert(
    userId: string,
    data: StyleAnalysisResult & { sampleCount: number },
  ) {
    return prisma.userStyleProfile.upsert({
      where: { userId },
      create: {
        userId,
        tone: data.tone,
        vocabKeywords: data.vocabKeywords,
        language: data.language,
        sentenceLength: data.sentenceLength,
        emojiUsage: data.emojiUsage,
        formalityLevel: data.formalityLevel,
        summary: data.summary,
        sampleCount: data.sampleCount,
        lastAnalyzedAt: new Date(),
      },
      update: {
        tone: data.tone,
        vocabKeywords: data.vocabKeywords,
        language: data.language,
        sentenceLength: data.sentenceLength,
        emojiUsage: data.emojiUsage,
        formalityLevel: data.formalityLevel,
        summary: data.summary,
        sampleCount: data.sampleCount,
        lastAnalyzedAt: new Date(),
      },
    });
  }

  async update(userId: string, dto: UpdateStyleProfileDto) {
    const existing = await this.getByUserId(userId);
    if (!existing) {
      throw new NotFoundException(
        "Style profile not found. Run analysis first.",
      );
    }

    return prisma.userStyleProfile.update({
      where: { userId },
      data: dto,
    });
  }

  async delete(userId: string) {
    const existing = await this.getByUserId(userId);
    if (!existing) {
      throw new NotFoundException("Style profile not found");
    }

    return prisma.userStyleProfile.delete({
      where: { userId },
    });
  }
}
