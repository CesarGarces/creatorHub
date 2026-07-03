import { Injectable, BadRequestException } from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { Logger } from "@creator-hub/shared-utils";
import { SocialResearchService } from "@creator-hub/social-research-backend";
import { TrendCacheService } from "@creator-hub/social-research-backend";
import {
  XApiService,
  type SearchResultTweet,
} from "@creator-hub/x-post-tweet-backend";
import { SocialService } from "./services/social.service";
import { OAuthEncryptionService } from "./services/oauth-encryption.service";

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
    private xApiService: XApiService,
    private socialService: SocialService,
    private encryptionService: OAuthEncryptionService,
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

    // Get user's active X account
    const account = await this.socialService.getActiveAccountByProvider(
      userId,
      "X_TWITTER",
    );

    if (!account) {
      throw new BadRequestException(
        "No active X account connected. Please connect your account in Settings.",
      );
    }

    const accessToken = this.encryptionService.decrypt(account.accessToken);

    this.logger.info("Starting X trend search via X API", {
      userId,
      topic: options.topic,
    });

    // Build search query
    let query = options.topic;
    if (options.language) {
      query += ` lang:${options.language}`;
    }
    if (!options.includeReplies) {
      query += " -is:reply";
    }

    // Calculate start time based on timeframe
    let startTime: string | undefined;
    if (options.timeframe) {
      const now = new Date();
      switch (options.timeframe) {
        case "24h":
          startTime = new Date(
            now.getTime() - 24 * 60 * 60 * 1000,
          ).toISOString();
          break;
        case "7d":
          startTime = new Date(
            now.getTime() - 7 * 24 * 60 * 60 * 1000,
          ).toISOString();
          break;
        case "30d":
          startTime = new Date(
            now.getTime() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString();
          break;
      }
    }

    // Search tweets using X API
    const searchResult = await this.xApiService.searchTweets(
      accessToken,
      query,
      {
        maxResults: options.maxTweets || 50,
        startTime,
      },
    );

    const tweets = searchResult.tweets;
    const formattedAnalysis = this.formatTweetsForAnalysis(tweets);
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

  private formatTweetsForAnalysis(tweets: SearchResultTweet[]): string {
    if (tweets.length === 0) {
      return "No tweets found for this topic.";
    }

    const formatted = tweets.slice(0, 10).map((tweet, index) => {
      const engagement =
        tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies;
      return `${index + 1}. @${tweet.author.username} (${tweet.author.followers} followers):
   "${tweet.text}"
   Engagement: ${engagement} (${tweet.metrics.likes} likes, ${tweet.metrics.retweets} RTs, ${tweet.metrics.replies} replies)
   Hashtags: ${tweet.hashtags.length > 0 ? tweet.hashtags.join(", ") : "none"}`;
    });

    const trendingHashtags = this.extractTrendingHashtags(tweets);

    return `TRENDING TWEETS:\n${formatted.join("\n\n")}\n\nTRENDING HASHTAGS: ${trendingHashtags.join(", ")}`;
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
