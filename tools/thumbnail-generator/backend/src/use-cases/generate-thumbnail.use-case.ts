import { Injectable } from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { MarketingEventService } from "./marketing-event.service";

export interface GenerateThumbnailInput {
  userId: string;
  prompt: string;
  negativePrompt?: string;
  style?: string;
  provider?: string;
  width?: number;
  height?: number;
}

export interface GenerateThumbnailOutput {
  jobId: string;
}

@Injectable()
export class GenerateThumbnailUseCase {
  private logger = new Logger("GenerateThumbnailUseCase");

  constructor(
    private aiEngine: AIEngineService,
    private marketingEventService: MarketingEventService
  ) {}

  async execute(input: GenerateThumbnailInput): Promise<GenerateThumbnailOutput> {
    const { userId, prompt, negativePrompt, style, provider, width, height } = input;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    const totalCredits = user.freeCredits + user.purchasedCredits;
    if (totalCredits <= 0) {
      throw new Error("No credits available. Please upgrade your plan or purchase credits.");
    }

    const selectedProvider = this.selectProvider(user, provider);

    const fullPrompt = style ? `${prompt}, ${style}` : prompt;

    const result = await this.aiEngine.generateImage(fullPrompt, {
      provider: selectedProvider as any,
      negativePrompt,
      width: width || 1280,
      height: height || 720,
      userId,
      toolId: "thumbnail-generator",
    });

    await this.marketingEventService.checkCreditThresholds(userId);

    return {
      jobId: crypto.randomUUID(),
    };
  }

  private selectProvider(user: any, requestedProvider?: string): string {
    if (requestedProvider) {
      if (user.plan === "FREE" && user.freeCredits > 0) {
        const freeProviders = ["siliconflow", "mock"];
        if (freeProviders.includes(requestedProvider)) {
          return requestedProvider;
        }
        return "siliconflow";
      }
      return requestedProvider;
    }

    if (user.plan === "FREE" && user.freeCredits > 0) {
      return "siliconflow";
    }

    return "openai";
  }
}
