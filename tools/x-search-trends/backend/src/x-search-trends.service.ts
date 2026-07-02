import { Injectable, BadRequestException } from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { Logger } from "@creator-hub/shared-utils";
import { ApifyService } from "./services/apify.service";

const SEARCH_CREDIT_COST = 15;

interface SearchOptions {
  topic: string;
  maxTweets?: number;
  timeframe?: string;
  language?: string;
  includeReplies?: boolean;
  sortBy?: string;
}

interface SearchResult {
  topic: string;
  tweetCount: number;
  tweets: any[];
  trendingHashtags: string[];
  formattedAnalysis: string;
}

@Injectable()
export class XSearchTrendsService {
  private logger = new Logger("XSearchTrendsService");

  constructor(
    private apifyService: ApifyService,
    private creditService: CreditService,
  ) {}

  async search(userId: string, options: SearchOptions): Promise<SearchResult> {
    if (!options.topic?.trim()) {
      throw new BadRequestException("Topic is required");
    }

    const hasCredits = await this.creditService.hasEnoughCredits(
      userId,
      SEARCH_CREDIT_COST,
    );

    if (!hasCredits) {
      throw new BadRequestException(
        `Insufficient credits. X trend search requires ${SEARCH_CREDIT_COST} credits.`,
      );
    }

    this.logger.info("Starting X trend search", {
      userId,
      topic: options.topic,
    });

    const tweets = await this.apifyService.searchTweets({
      topic: options.topic,
      maxTweets: options.maxTweets || 20,
      timeframe: options.timeframe || "24h",
      language: options.language || "en",
      includeReplies: options.includeReplies || false,
      sortBy: options.sortBy || "relevance",
    });

    const formattedAnalysis = this.apifyService.formatTweetsForAnalysis(tweets);
    const trendingHashtags = this.extractTrendingHashtags(tweets);

    await this.creditService.deduct(
      userId,
      SEARCH_CREDIT_COST,
      "x-search-trends",
      `X trend search: ${options.topic}`,
    );

    this.logger.info("X trend search completed", {
      userId,
      topic: options.topic,
      tweetCount: tweets.length,
    });

    return {
      topic: options.topic,
      tweetCount: tweets.length,
      tweets: tweets.slice(0, 10),
      trendingHashtags,
      formattedAnalysis,
    };
  }

  private extractTrendingHashtags(tweets: Record<string, unknown>[]): string[] {
    const hashtagCounts = new Map<string, number>();

    tweets.forEach((tweet) => {
      if (tweet.hashtags && Array.isArray(tweet.hashtags)) {
        tweet.hashtags.forEach((tag: string) => {
          const normalized = tag.toLowerCase().replace(/^#/, "");
          hashtagCounts.set(
            normalized,
            (hashtagCounts.get(normalized) || 0) + 1,
          );
        });
      }
    });

    return Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => `#${tag}`);
  }
}
