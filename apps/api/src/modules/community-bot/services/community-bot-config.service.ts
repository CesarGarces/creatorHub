import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import type { UpdateCommunityBotConfigDto } from "../dto/update-community-bot-config.dto";

const CHAT_TASK_TYPES = ["text-generation", "chat"];

/**
 * Owns the per-creator CommunityBotConfig row. The config is created
 * lazily with safe defaults (bot disabled) on first access.
 */
@Injectable()
export class CommunityBotConfigService {
  async getOrCreate(userId: string) {
    const existing = await prisma.communityBotConfig.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return prisma.communityBotConfig.create({ data: { userId } });
  }

  async update(userId: string, dto: UpdateCommunityBotConfigDto) {
    if (dto.modelId) {
      await this.assertModelSelectable(userId, dto.modelId);
    }

    await this.getOrCreate(userId);

    return prisma.communityBotConfig.update({
      where: { userId },
      data: {
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.modelId !== undefined ? { modelId: dto.modelId } : {}),
        ...(dto.temperature !== undefined
          ? { temperature: dto.temperature }
          : {}),
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        ...(dto.systemPromptExtra !== undefined
          ? { systemPromptExtra: dto.systemPromptExtra }
          : {}),
        ...(dto.useStyleProfile !== undefined
          ? { useStyleProfile: dto.useStyleProfile }
          : {}),
        ...(dto.historyLength !== undefined
          ? { historyLength: dto.historyLength }
          : {}),
        ...(dto.dailyReplyLimit !== undefined
          ? { dailyReplyLimit: dto.dailyReplyLimit }
          : {}),
        ...(dto.perContactCooldownSec !== undefined
          ? { perContactCooldownSec: dto.perContactCooldownSec }
          : {}),
      },
    });
  }

  /**
   * Same plan/tier rule the tools enforce: FREE-plan creators can only
   * select free-tier chat models.
   */
  private async assertModelSelectable(
    userId: string,
    modelId: string,
  ): Promise<void> {
    const model = await prisma.modelMetadata.findFirst({
      where: { modelId, isActive: true, taskType: { in: CHAT_TASK_TYPES } },
      select: { tier: true },
    });

    if (!model) {
      throw new BadRequestException(
        `Model "${modelId}" is not an active chat model`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    if (model.tier === "PRO" && user?.plan === "FREE") {
      throw new ForbiddenException(
        "PRO chat models require a paid plan — upgrade to use this model",
      );
    }
  }
}
