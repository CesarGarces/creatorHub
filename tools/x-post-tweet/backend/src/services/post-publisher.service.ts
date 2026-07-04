import { Injectable, BadRequestException } from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { Logger } from "@creator-hub/shared-utils";
import { prisma, type TweetDraft } from "@creator-hub/database";
import { XApiService } from "./x-api.service";

const PUBLISH_CREDIT_COST = 15;

interface PublishOptions {
  userId: string;
  draftId: string;
  accessToken: string;
}

interface PublishResult {
  draft: TweetDraft;
  tweetId: string;
  tweetUrl: string;
}

@Injectable()
export class PostPublisherService {
  private logger = new Logger("PostPublisherService");

  constructor(
    private xApiService: XApiService,
    private creditService: CreditService,
  ) {}

  async publishDraft(options: PublishOptions): Promise<PublishResult> {
    this.logger.info("Publishing draft", {
      userId: options.userId,
      draftId: options.draftId,
    });

    const draft = await prisma.tweetDraft.findFirst({
      where: { id: options.draftId, userId: options.userId },
    });

    if (!draft) {
      throw new BadRequestException("Draft not found");
    }

    if (draft.status === "PUBLISHED") {
      throw new BadRequestException("Draft already published");
    }

    if (!draft.content?.trim()) {
      throw new BadRequestException("Draft has no content");
    }

    const hasCredits = await this.creditService.hasEnoughCredits(
      options.userId,
      PUBLISH_CREDIT_COST,
    );

    if (!hasCredits) {
      throw new BadRequestException(
        `Insufficient credits. Publishing requires ${PUBLISH_CREDIT_COST} credits.`,
      );
    }

    try {
      const tweetResult = await this.xApiService.publishTweet(
        options.accessToken,
        draft.content,
      );

      const updatedDraft = await prisma.tweetDraft.update({
        where: { id: options.draftId },
        data: {
          status: "PUBLISHED",
          publishedTweetId: tweetResult.id,
          publishedAt: new Date(),
        },
      });

      await this.creditService.deduct(
        options.userId,
        PUBLISH_CREDIT_COST,
        "x-post-tweet",
        `Published tweet: ${draft.topic || "untitled"}`,
      );

      const tweetUrl = `https://x.com/i/status/${tweetResult.id}`;

      this.logger.info("Draft published successfully", {
        userId: options.userId,
        draftId: options.draftId,
        tweetId: tweetResult.id,
      });

      return {
        draft: updatedDraft,
        tweetId: tweetResult.id,
        tweetUrl,
      };
    } catch (error) {
      await prisma.tweetDraft.update({
        where: { id: options.draftId },
        data: {
          status: "FAILED",
          metadata: {
            error: (error as Error).message,
            failedAt: new Date().toISOString(),
          },
        },
      });

      this.logger.error("Failed to publish draft", {
        userId: options.userId,
        draftId: options.draftId,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  async getPublishedTweets(userId: string): Promise<TweetDraft[]> {
    return prisma.tweetDraft.findMany({
      where: {
        userId,
        status: "PUBLISHED",
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
    });
  }
}
