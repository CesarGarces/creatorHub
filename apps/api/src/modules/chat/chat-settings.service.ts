import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ChatSettingsService {
  private logger = new Logger("ChatSettingsService");

  async getSettings(userId: string): Promise<any> {
    const settings = await prisma.chatSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return this.createDefaultSettings(userId);
    }

    return settings;
  }

  async updateSettings(
    userId: string,
    data: {
      defaultModel?: string;
      temperature?: number;
      maxTokens?: number;
      reasoning?: number;
    },
  ): Promise<any> {
    return prisma.chatSettings.upsert({
      where: { userId },
      create: {
        userId,
        defaultModel: data.defaultModel || "deepseek-ai/DeepSeek-V4-Flash",
        temperature: data.temperature ?? 0.7,
        maxTokens: data.maxTokens ?? 8000,
        reasoning: data.reasoning ?? 0.7,
      },
      update: data,
    });
  }

  private async createDefaultSettings(userId: string): Promise<any> {
    return prisma.chatSettings.create({
      data: {
        userId,
        defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
        temperature: 0.7,
        maxTokens: 8000,
        reasoning: 0.7,
      },
    });
  }
}
