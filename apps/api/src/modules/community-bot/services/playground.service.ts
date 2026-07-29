import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { StyleContextService } from "@creator-hub/community-bot";
import type { AIModel } from "@creator-hub/shared-types";

const DEFAULT_CREDIT_COST = 1;

export interface PlaygroundResult {
  reply: string;
  modelId: string;
  creditsUsed: number;
  balance: number;
}

/**
 * Lets the creator test-drive the bot's voice from the settings UI
 * before enabling live channels. Runs the exact same prompt pipeline as
 * the worker (StyleContextService + configured model) and bills the
 * model's credit cost, because a real AI generation happens.
 */
@Injectable()
export class PlaygroundService {
  private readonly logger = new Logger(PlaygroundService.name);

  constructor(
    private readonly aiEngine: AIEngineService,
    private readonly creditService: CreditService,
    private readonly styleContext: StyleContextService,
  ) {}

  async generatePreview(
    userId: string,
    message: string,
  ): Promise<PlaygroundResult> {
    const config = await prisma.communityBotConfig.findUnique({
      where: { userId },
    });
    if (!config) {
      throw new BadRequestException(
        "Configure the community bot before using the playground",
      );
    }

    const creditCost = await this.resolveCreditCost(config.modelId);
    const hasCredits = await this.creditService.hasEnoughCredits(
      userId,
      creditCost,
    );
    if (!hasCredits) {
      throw new HttpException(
        `Insufficient credits — this preview costs ${creditCost} credit(s)`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const systemPrompt = await this.styleContext.buildSystemPrompt({
      userId,
      useStyleProfile: config.useStyleProfile,
      systemPromptExtra: config.systemPromptExtra,
    });

    const response = await this.aiEngine.execute({
      taskType: "text-generation",
      model: config.modelId as AIModel,
      prompt: message,
      parameters: {
        systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
      userId,
    });

    if (response.output.type !== "text" || !response.output.content.trim()) {
      throw new BadRequestException(
        "The AI provider returned an empty reply — try again",
      );
    }

    const deducted = await this.creditService.deduct(
      userId,
      creditCost,
      undefined,
      "Community bot playground preview",
    );
    if (!deducted) {
      throw new HttpException(
        "Insufficient credits — balance changed during the request",
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const balance = await this.creditService.getBalance(userId);

    this.logger.log("Playground preview generated", {
      userId,
      modelId: response.model,
      creditsUsed: creditCost,
    });

    return {
      reply: response.output.content.trim(),
      modelId: response.model || config.modelId,
      creditsUsed: creditCost,
      balance,
    };
  }

  private async resolveCreditCost(modelId: string): Promise<number> {
    const metadata = await prisma.modelMetadata.findFirst({
      where: { modelId, isActive: true },
      select: { creditCost: true },
    });
    return metadata?.creditCost ?? DEFAULT_CREDIT_COST;
  }
}
