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
import {
  TwitterCrawlerService,
  type CrawledTweet,
} from "./services/twitter-crawler.service";

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
    private twitterCrawler: TwitterCrawlerService,
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

    this.logger.info("Starting X trend search", {
      userId,
      topic: options.topic,
    });

    // Try X API first, fallback to Crawlee
    let tweets: SearchResultTweet[] = [];
    let usedFallback = false;

    try {
      // Get user's active X account
      const account = await this.socialService.getActiveAccountByProvider(
        userId,
        "X_TWITTER",
      );

      if (!account) {
        throw new BadRequestException(
          "No X account connected. Please connect your X account first.",
        );
      }

      const accessToken = this.encryptionService.decrypt(account.accessToken);

      // Build search query - extract keywords from user input
      let query = this.buildSearchQuery(options.topic);
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

      tweets = searchResult.tweets;

      // If X API returned 0 results, try Crawlee as fallback
      if (tweets.length === 0) {
        this.logger.info("X API returned 0 results, trying Crawlee fallback", {
          userId,
          topic: options.topic,
        });

        usedFallback = true;
        const crawledTweets = await this.twitterCrawler.searchTweets(
          options.topic,
          {
            maxResults: options.maxTweets || 50,
            timeframe: options.timeframe,
            language: options.language,
          },
        );

        tweets = crawledTweets.map((t) => ({
          id: t.id,
          text: t.text,
          createdAt: t.createdAt,
          author: t.author,
          metrics: t.metrics,
          hashtags: t.hashtags,
          urls: t.urls,
          media: t.media,
        }));
      }
    } catch (error) {
      // X API failed - fallback to Crawlee
      this.logger.warn("X API search failed, falling back to Crawlee", {
        error: (error as Error).message,
        userId,
        topic: options.topic,
      });

      usedFallback = true;

      try {
        const crawledTweets = await this.twitterCrawler.searchTweets(
          options.topic,
          {
            maxResults: options.maxTweets || 50,
            timeframe: options.timeframe,
            language: options.language,
          },
        );

        // Convert CrawledTweet to SearchResultTweet format
        tweets = crawledTweets.map((t) => ({
          id: t.id,
          text: t.text,
          createdAt: t.createdAt,
          author: t.author,
          metrics: t.metrics,
          hashtags: t.hashtags,
          urls: t.urls,
          media: t.media,
        }));
      } catch (crawlerError) {
        this.logger.error("Crawlee fallback also failed", {
          error: (crawlerError as Error).message,
        });
        throw new BadRequestException(
          "Failed to search tweets. Please try again later.",
        );
      }
    }

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

    // Only cache if we have results (avoid caching empty results)
    if (tweets.length > 0) {
      await this.cacheService.set(options.topic, CACHE_PROVIDER, result);
    }

    await this.creditService.deduct(
      userId,
      SEARCH_CREDIT_COST,
      "x-search-trends",
      `X trend search: ${options.topic}${usedFallback ? " (via Crawlee)" : ""}`,
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
      usedFallback,
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

  /**
   * Transform natural language user input into a valid X search query.
   * X API expects search operators, not conversational text.
   *
   * "Analyze what's trending on X about AI today" → "AI"
   * "Research trending topics about crypto on Twitter" → "crypto"
   * "What are people saying about the new iPhone" → "iPhone"
   */
  private buildSearchQuery(topic: string): string {
    // Common filler words to remove
    const fillers =
      /\b(analyze|research|find|search|look|tell|me|about|what|are|people|saying|trending|trend|topics?|on|twitter|x|today|now|latest|news|recently|popular)\b/gi;

    // Remove filler words
    let cleaned = topic.replace(fillers, " ").trim();

    // Remove extra spaces
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // If nothing meaningful left, use original topic
    if (cleaned.length < 2) {
      // Extract any hashtags or @mentions as they're valid search terms
      const hashtags = topic.match(/#\w+/g);
      const mentions = topic.match(/@\w+/g);
      if (hashtags?.length) return hashtags.join(" OR ");
      if (mentions?.length) return mentions.join(" OR ");
      return topic;
    }

    // If multiple words, wrap in quotes for exact phrase OR search
    const words = cleaned.split(" ").filter((w) => w.length > 1);
    if (words.length > 3) {
      // Too many words, take the most important ones (last 2-3)
      return words.slice(-3).join(" ");
    }

    return cleaned;
  }
}
