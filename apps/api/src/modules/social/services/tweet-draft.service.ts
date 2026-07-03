import { Injectable, BadRequestException } from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { Logger } from "@creator-hub/shared-utils";
import { prisma, type TweetDraft } from "@creator-hub/database";
import { StyleInjectionService } from "../../user-style/services/style-injection.service";

interface CreateDraftOptions {
  userId: string;
  topic: string;
  researchData: any;
  styleProfileId?: string;
}

interface GenerateTweetOptions {
  userId: string;
  topic: string;
  researchData: any;
  instructions?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

@Injectable()
export class TweetDraftService {
  private logger = new Logger("TweetDraftService");

  constructor(
    private aiEngine: AIEngineService,
    private styleInjection: StyleInjectionService,
    private creditService: CreditService,
  ) {}

  async createDraft(options: CreateDraftOptions): Promise<TweetDraft> {
    this.logger.info("Creating tweet draft", {
      userId: options.userId,
      topic: options.topic,
    });

    const draft = await prisma.tweetDraft.create({
      data: {
        userId: options.userId,
        content: "",
        topic: options.topic,
        researchData: options.researchData,
        styleProfileId: options.styleProfileId,
        status: "DRAFT",
      },
    });

    return draft;
  }

  async generateTweet(options: GenerateTweetOptions): Promise<TweetDraft> {
    this.logger.info("Generating tweet with AI", {
      userId: options.userId,
      topic: options.topic,
      model: options.model,
    });

    const model = options.model || "zai-org/GLM-5.2";
    const providerRecord = await prisma.provider.findFirst({
      where: { model, isActive: true },
    });
    const creditCost = providerRecord?.costPerCredit ?? 10;

    const hasCredits = await this.creditService.hasEnoughCredits(
      options.userId,
      creditCost,
    );
    if (!hasCredits) {
      throw new BadRequestException(
        `Insufficient credits. This model requires ${creditCost} credits.`,
      );
    }

    let stylePrompt = "";
    try {
      stylePrompt = await this.styleInjection.getStylePrompt(options.userId);
    } catch (error) {
      this.logger.warn("Failed to get style prompt, continuing without it", {
        userId: options.userId,
        error: (error as Error).message,
      });
    }

    const researchContext = this.formatResearchData(options.researchData);

    const systemPrompt = `You are a social media expert who writes engaging tweets.

${stylePrompt}

RESEARCH DATA:
${researchContext}

INSTRUCTIONS:
1. Write a tweet (max 280 characters) about: ${options.topic}
2. Use the research data to make it relevant and timely
3. Apply the user's style profile strictly
4. Include 1-2 relevant hashtags if appropriate
5. Make it engaging and shareable
${options.instructions ? `6. Additional instructions: ${options.instructions}` : ""}

Respond with ONLY the tweet text, no explanations or quotes.`;

    let result;
    try {
      result = await this.aiEngine.execute({
        taskType: "text-generation",
        prompt: systemPrompt,
        userId: options.userId,
        model: options.model as any,
        parameters: {
          temperature: options.temperature ?? 0.7,
          maxTokens: options.maxTokens ?? 300,
        },
      });
    } catch (error) {
      this.logger.error("AI engine execution failed", {
        userId: options.userId,
        model: options.model,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw new BadRequestException(
        `Failed to generate tweet: ${(error as Error).message}`,
      );
    }

    const tweetContent =
      result.output.type === "text" ? result.output.content.trim() : "";

    if (!tweetContent) {
      throw new BadRequestException("Failed to generate tweet content");
    }

    if (tweetContent.length > 280) {
      this.logger.warn("Generated tweet exceeds 280 chars, truncating", {
        userId: options.userId,
        length: tweetContent.length,
      });
    }

    const draft = await prisma.tweetDraft.create({
      data: {
        userId: options.userId,
        content: tweetContent.slice(0, 280),
        topic: options.topic,
        researchData: options.researchData,
        status: "PREVIEW",
      },
    });

    const deducted = await this.creditService.deduct(
      options.userId,
      creditCost,
      "x-post-tweet",
      `Generated tweet with ${model}`,
    );

    if (!deducted) {
      this.logger.warn("Credit deduction failed after tweet generation", {
        userId: options.userId,
        model,
        creditCost,
      });
    }

    this.logger.info("Tweet generated successfully", {
      userId: options.userId,
      draftId: draft.id,
      charCount: draft.content.length,
    });

    return draft;
  }

  async getDraft(userId: string, draftId: string): Promise<TweetDraft> {
    const draft = await prisma.tweetDraft.findFirst({
      where: { id: draftId, userId },
    });

    if (!draft) {
      throw new BadRequestException("Draft not found");
    }

    return draft;
  }

  async getDrafts(userId: string, status?: string): Promise<TweetDraft[]> {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    return prisma.tweetDraft.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async updateDraft(
    userId: string,
    draftId: string,
    content: string,
  ): Promise<TweetDraft> {
    const draft = await this.getDraft(userId, draftId);

    if (content.length > 280) {
      throw new BadRequestException("Tweet content exceeds 280 characters");
    }

    return prisma.tweetDraft.update({
      where: { id: draftId },
      data: { content, status: "PREVIEW" },
    });
  }

  async markAsPublished(
    userId: string,
    draftId: string,
    publishedTweetId: string,
  ): Promise<TweetDraft> {
    const draft = await this.getDraft(userId, draftId);

    return prisma.tweetDraft.update({
      where: { id: draftId },
      data: {
        status: "PUBLISHED",
        publishedTweetId,
        publishedAt: new Date(),
      },
    });
  }

  async deleteDraft(userId: string, draftId: string): Promise<void> {
    const draft = await this.getDraft(userId, draftId);

    await prisma.tweetDraft.delete({
      where: { id: draftId },
    });

    this.logger.info("Draft deleted", { userId, draftId });
  }

  private formatResearchData(data: any): string {
    if (!data) {
      return "No research data available.";
    }

    if (typeof data === "string") {
      return data;
    }

    if (data.formattedAnalysis) {
      return data.formattedAnalysis;
    }

    if (data.tweets && Array.isArray(data.tweets)) {
      const tweets = data.tweets
        .slice(0, 5)
        .map((tweet: any, index: number) => {
          const author = tweet.author?.username || "unknown";
          const text = tweet.text || "";
          const likes = tweet.metrics?.likes || 0;
          const retweets = tweet.metrics?.retweets || 0;
          return `${index + 1}. @${author}: "${text}" (${likes} likes, ${retweets} RTs)`;
        });

      const hashtags = data.trendingHashtags?.join(", ") || "none";

      return `TRENDING TWEETS:\n${tweets.join("\n")}\n\nTRENDING HASHTAGS: ${hashtags}`;
    }

    return JSON.stringify(data, null, 2);
  }
}
