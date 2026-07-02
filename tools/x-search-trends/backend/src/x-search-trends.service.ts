import { Injectable, BadRequestException } from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { Logger } from "@creator-hub/shared-utils";
import { SocialResearchService } from "@creator-hub/social-research-backend";
import { TrendCacheService } from "@creator-hub/social-research-backend";
import { ApifyService } from "./services/apify.service";

const SEARCH_CREDIT_COST = 15;
const CACHE_PROVIDER = "x";

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
  fromCache: boolean;
}

@Injectable()
export class XSearchTrendsService {
  private logger = new Logger("XSearchTrendsService");

  constructor(
    private apifyService: ApifyService,
    private creditService: CreditService,
    private socialResearch: SocialResearchService,
    private cacheService: TrendCacheService,
  ) {}

  async search(
    userId: string,
    options: SearchOptions,
    sessionId?: string,
  ): Promise<SearchResult & { sessionId: string }> {
    if (!options.topic?.trim()) {
      throw new BadRequestException("Topic is required");
    }

    const session = await this.socialResearch.getOrCreateSession(
      userId,
      "x-search-trends",
      sessionId,
    );

    await this.socialResearch.addMessage(session.id, {
      role: "user",
      content: options.topic,
      provider: "x",
    });

    const cached = await this.cacheService.get(options.topic, CACHE_PROVIDER);

    if (cached) {
      this.logger.info("Serving from cache", {
        userId,
        topic: options.topic,
      });

      const result = cached as SearchResult;

      await this.socialResearch.addMessage(session.id, {
        role: "assistant",
        content: result.formattedAnalysis,
        resultData: result,
        provider: "x",
        creditsUsed: 0,
        cacheHit: true,
      });

      return { ...result, sessionId: session.id };
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
      maxTweets: options.maxTweets || 50,
      timeframe: options.timeframe || "24h",
      language: options.language || "en",
      includeReplies: options.includeReplies || false,
      sortBy: options.sortBy || "relevance",
    });

    const formattedAnalysis = this.apifyService.formatTweetsForAnalysis(tweets);
    const trendingHashtags = this.extractTrendingHashtags(tweets);

    const result: SearchResult = {
      topic: options.topic,
      tweetCount: tweets.length,
      tweets: tweets.slice(0, 10),
      trendingHashtags,
      formattedAnalysis,
      fromCache: false,
    };

    await this.cacheService.set(options.topic, CACHE_PROVIDER, result);

    await this.creditService.deduct(
      userId,
      SEARCH_CREDIT_COST,
      "x-search-trends",
      `X trend search: ${options.topic}`,
    );

    await this.socialResearch.addMessage(session.id, {
      role: "assistant",
      content: formattedAnalysis,
      resultData: result,
      provider: "x",
      creditsUsed: SEARCH_CREDIT_COST,
      cacheHit: false,
    });

    this.logger.info("X trend search completed", {
      userId,
      topic: options.topic,
      tweetCount: tweets.length,
    });

    return { ...result, sessionId: session.id };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTrendingHashtags(tweets: any[]): string[] {
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
