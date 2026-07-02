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

    let tweets: any[];

    const hasApify = !!process.env.APIFY_API_TOKEN;

    if (!hasApify) {
      this.logger.warn("[MOCK] No APIFY_API_TOKEN, using mock data");
      tweets = this.getMockTweets(options.topic);
    } else {
      try {
        tweets = await this.apifyService.searchTweets({
          topic: options.topic,
          maxTweets: options.maxTweets || 20,
          timeframe: options.timeframe || "24h",
          language: options.language || "en",
          includeReplies: options.includeReplies || false,
          sortBy: options.sortBy || "relevance",
        });
      } catch (apifyError) {
        this.logger.error("[FALLBACK] Apify failed, using mock data", {
          error: (apifyError as Error).message,
        });
        tweets = this.getMockTweets(options.topic);
      }
    }

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

  private getMockTweets(topic: string): any[] {
    return [
      {
        id: `mock_${Date.now()}_1`,
        text: `This is a mock tweet about ${topic} for development testing. #mock #dev`,
        author: { username: "dev_user", name: "Dev User", followers: 1000 },
        metrics: { likes: 42, retweets: 10, replies: 5 },
        hashtags: ["mock", "dev"],
        createdAt: new Date().toISOString(),
      },
      {
        id: `mock_${Date.now()}_2`,
        text: `Interesting discussion about ${topic} happening here! #trending`,
        author: {
          username: "trend_watcher",
          name: "Trend Watcher",
          followers: 5000,
        },
        metrics: { likes: 128, retweets: 32, replies: 15 },
        hashtags: ["trending"],
        createdAt: new Date().toISOString(),
      },
      {
        id: `mock_${Date.now()}_3`,
        text: `Just shared my thoughts on ${topic}. What do you think? #opinion`,
        author: {
          username: "tech_opinion",
          name: "Tech Opinion",
          followers: 2500,
        },
        metrics: { likes: 67, retweets: 8, replies: 12 },
        hashtags: ["opinion"],
        createdAt: new Date().toISOString(),
      },
      {
        id: `mock_${Date.now()}_4`,
        text: `Breaking: New developments in ${topic}! #news #update`,
        author: { username: "news_bot", name: "News Bot", followers: 15000 },
        metrics: { likes: 256, retweets: 89, replies: 34 },
        hashtags: ["news", "update"],
        createdAt: new Date().toISOString(),
      },
      {
        id: `mock_${Date.now()}_5`,
        text: `My experience with ${topic} so far has been amazing! #experience`,
        author: {
          username: "experience_sharer",
          name: "Experience Sharer",
          followers: 800,
        },
        metrics: { likes: 31, retweets: 5, replies: 8 },
        hashtags: ["experience"],
        createdAt: new Date().toISOString(),
      },
    ];
  }
}
