import { Injectable, BadRequestException } from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { Logger } from "@creator-hub/shared-utils";
import { SocialResearchService } from "@creator-hub/social-research-backend";
import { TrendCacheService } from "@creator-hub/social-research-backend";
import { AIEngineService } from "@creator-hub/ai-engine";
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
import {
  TweetAnalysisService,
  type FilteredTweet,
  type TweetAnalysis,
} from "./services/tweet-analysis.service";

const SEARCH_CREDIT_COST = 15;
const AI_ANALYSIS_CREDIT_COST = 10;
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
  originalTweetCount: number;
  tweets: FilteredTweet[];
  trendingHashtags: string[];
  formattedAnalysis: string;
  analysis: TweetAnalysis;
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
    private tweetAnalysis: TweetAnalysisService,
    private aiEngine: AIEngineService,
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

    const totalCreditsNeeded = SEARCH_CREDIT_COST + AI_ANALYSIS_CREDIT_COST;
    const hasCredits = await this.creditService.hasEnoughCredits(
      userId,
      totalCreditsNeeded,
    );

    if (!hasCredits) {
      throw new BadRequestException(
        `Insufficient credits. X trend search requires ${totalCreditsNeeded} credits.`,
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

    // Filter and analyze tweets
    const originalTweetCount = tweets.length;
    const filteredTweets = this.tweetAnalysis.filterTweets(tweets);

    this.logger.info("Tweets filtered", {
      original: originalTweetCount,
      filtered: filteredTweets.length,
    });

    // Generate AI analysis
    let analysis: TweetAnalysis;
    try {
      analysis = await this.generateAIAnalysis(options.topic, filteredTweets);
    } catch (error) {
      this.logger.warn("AI analysis failed, using basic analysis", {
        error: (error as Error).message,
      });
      analysis = this.generateBasicAnalysis(filteredTweets);
    }

    const trendingHashtags = this.extractTrendingHashtags(filteredTweets);
    const formattedAnalysis = this.formatAnalysis(
      options.topic,
      filteredTweets,
      analysis,
    );

    const result: SearchResult = {
      topic: options.topic,
      tweetCount: filteredTweets.length,
      originalTweetCount,
      tweets: filteredTweets.slice(0, 20),
      trendingHashtags,
      formattedAnalysis,
      analysis,
      fromCache: false,
    };

    // Only cache if we have results
    if (filteredTweets.length > 0) {
      await this.cacheService.set(options.topic, CACHE_PROVIDER, result);
    }

    // Deduct credits
    await this.creditService.deduct(
      userId,
      SEARCH_CREDIT_COST,
      "x-search-trends",
      `X trend search: ${options.topic}${usedFallback ? " (via Crawlee)" : ""}`,
    );

    await this.creditService.deduct(
      userId,
      AI_ANALYSIS_CREDIT_COST,
      "x-search-trends",
      `AI analysis: ${options.topic}`,
    );

    await this.socialResearch.addMessage(session.id, {
      role: "assistant",
      content: formattedAnalysis,
      resultData: result,
      provider: "x",
      creditsUsed: totalCreditsNeeded,
      cacheHit: false,
    });

    this.logger.info("X trend search completed", {
      userId,
      topic: options.topic,
      originalCount: originalTweetCount,
      filteredCount: filteredTweets.length,
      usedFallback,
    });

    return { ...result, sessionId: session.id };
  }

  /**
   * Generate AI-powered analysis of tweets
   */
  private async generateAIAnalysis(
    topic: string,
    tweets: FilteredTweet[],
  ): Promise<TweetAnalysis> {
    const tweetData = tweets
      .slice(0, 30)
      .map(
        (t) =>
          `@${t.author.username} (${t.author.followers} followers, verified: ${t.author.verified}):
"${t.text}"
Sentiment: ${t.sentiment}, Themes: ${t.themes.join(", ")}`,
      )
      .join("\n\n");

    const prompt = `Analyze these tweets about "${topic}" and provide insights.

Tweets:
${tweetData}

Return ONLY valid JSON (no markdown, no explanation):
{"executiveSummary":"2-3 sentence summary","themes":[{"name":"Theme","description":"Brief","tweetCount":1,"sentiment":"positive"}],"overallSentiment":"positive","keyInfluencers":[{"username":"user","name":"Name","followers":1000,"verified":false,"tweetCount":1}]}`;

    const response = await this.aiEngine.execute({
      taskType: "text-generation",
      prompt,
      parameters: {
        temperature: 0.3,
        maxTokens: 1000,
      },
    });

    // Try to parse JSON from the response
    let parsed: TweetAnalysis | null = null;

    if (response.output.type === "json") {
      parsed = response.output.data as unknown as TweetAnalysis;
    } else if (response.output.type === "text") {
      // Try to extract JSON from text response
      const text = response.output.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]) as TweetAnalysis;
        } catch {
          // JSON parse failed
        }
      }
    }

    if (!parsed || !parsed.executiveSummary) {
      throw new Error("AI did not return valid analysis");
    }
    return {
      executiveSummary:
        parsed.executiveSummary || "Analysis completed successfully.",
      themes: parsed.themes || [],
      overallSentiment: parsed.overallSentiment || "neutral",
      keyInfluencers: parsed.keyInfluencers || [],
      filteredTweetCount: tweets.length,
      originalTweetCount: tweets.length,
    };
  }

  /**
   * Generate basic analysis without AI
   */
  private generateBasicAnalysis(tweets: FilteredTweet[]): TweetAnalysis {
    // Count sentiments
    const sentiments = { positive: 0, negative: 0, neutral: 0 };
    tweets.forEach((t) => sentiments[t.sentiment]++);

    // Count themes
    const themeCounts = new Map<string, number>();
    tweets.forEach((t) =>
      t.themes.forEach((theme) =>
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1),
      ),
    );

    // Get top influencers
    const influencerMap = new Map<
      string,
      {
        username: string;
        name: string;
        followers: number;
        verified: boolean;
        tweetCount: number;
      }
    >();
    tweets.forEach((t) => {
      const existing = influencerMap.get(t.author.username);
      if (existing) {
        existing.tweetCount++;
      } else {
        influencerMap.set(t.author.username, {
          username: t.author.username,
          name: t.author.name,
          followers: t.author.followers,
          verified: t.author.verified,
          tweetCount: 1,
        });
      }
    });

    const keyInfluencers = Array.from(influencerMap.values())
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 5);

    const overallSentiment =
      sentiments.positive > sentiments.negative
        ? "positive"
        : sentiments.negative > sentiments.positive
          ? "negative"
          : "neutral";

    return {
      executiveSummary: `Analysis of ${tweets.length} tweets about this topic.`,
      themes: Array.from(themeCounts.entries()).map(([name, count]) => ({
        name,
        description: `Tweets related to ${name}`,
        tweetCount: count,
        sentiment: "neutral" as const,
      })),
      overallSentiment,
      keyInfluencers,
      filteredTweetCount: tweets.length,
      originalTweetCount: tweets.length,
    };
  }

  /**
   * Format analysis for display
   */
  private formatAnalysis(
    topic: string,
    tweets: FilteredTweet[],
    analysis: TweetAnalysis,
  ): string {
    const sentimentEmoji =
      analysis.overallSentiment === "positive"
        ? "📈"
        : analysis.overallSentiment === "negative"
          ? "📉"
          : "➡️";

    let output = `# Trend Analysis: ${topic}\n\n`;

    // Executive Summary
    output += `## Executive Summary\n${analysis.executiveSummary}\n\n`;

    // Sentiment
    output += `## Overall Sentiment ${sentimentEmoji}\n${analysis.overallSentiment.toUpperCase()}\n\n`;

    // Key Themes
    if (analysis.themes.length > 0) {
      output += `## Key Themes\n`;
      analysis.themes.slice(0, 5).forEach((theme, i) => {
        const themeEmoji =
          theme.sentiment === "positive"
            ? "🟢"
            : theme.sentiment === "negative"
              ? "🔴"
              : "⚪";
        output += `${i + 1}. ${themeEmoji} **${theme.name}** (${theme.tweetCount} tweets) - ${theme.description}\n`;
      });
      output += "\n";
    }

    // Key Influencers
    if (analysis.keyInfluencers.length > 0) {
      output += `## Key Influencers\n`;
      analysis.keyInfluencers.forEach((inf, i) => {
        const verified = inf.verified ? " ✓" : "";
        output += `${i + 1}. @${inf.username}${verified} (${inf.followers.toLocaleString()} followers) - ${inf.tweetCount} tweets\n`;
      });
      output += "\n";
    }

    // Top Tweets (filtered)
    const topTweets = tweets.slice(0, 10);
    if (topTweets.length > 0) {
      output += `## Top Tweets (${tweets.length} filtered from original results)\n\n`;
      topTweets.forEach((tweet, i) => {
        const engagement =
          tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies;
        const authority =
          tweet.authority === "high"
            ? "🔥"
            : tweet.authority === "medium"
              ? "⚡"
              : "";
        const sentimentIcon =
          tweet.sentiment === "positive"
            ? "🟢"
            : tweet.sentiment === "negative"
              ? "🔴"
              : "";

        output += `### ${i + 1}. @${tweet.author.username} ${authority} ${sentimentIcon}\n`;
        output += `**Followers:** ${tweet.author.followers.toLocaleString()} | **Engagement:** ${engagement.toLocaleString()}\n`;
        output += `> ${tweet.text.substring(0, 200)}${tweet.text.length > 200 ? "..." : ""}\n`;
        output += `[View on X →](https://x.com/${tweet.author.username}/status/${tweet.id})\n\n`;
      });
    }

    // Trending Hashtags
    const hashtags = this.extractTrendingHashtags(tweets);
    if (hashtags.length > 0) {
      output += `## Trending Hashtags\n${hashtags.join(" | ")}\n`;
    }

    return output;
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
      .slice(0, 10)
      .map(([tag]) => `#${tag}`);
  }

  /**
   * Transform natural language user input into a valid X search query.
   */
  private buildSearchQuery(topic: string): string {
    // Extract hashtags and mentions first
    const hashtags = topic.match(/#\w+/g);
    const mentions = topic.match(/@\w+/g);
    if (hashtags?.length) return hashtags.join(" OR ");
    if (mentions?.length) return mentions.join(" OR ");

    // Common filler words/phrases to remove (English + Spanish)
    const fillers =
      /\b(analyze|research|find|search|look|tell|me|about|what'?s?|are|people|saying|trending|trend|topics?|on|twitter|x|today|now|latest|news|recently|popular|the|new|how|who|which|when|where|why|can|could|would|should|do|does|did|have|has|had|is|am|was|were|be|been|being|this|that|these|those|it|its|my|your|his|her|our|their|dame|los|mas|relevante|relevantes|de|en|el|la|las|los|un|una|unos|unas|que|como|con|por|para|sin|sobre|entre|hasta|desde|segun|durante|mediante|hacia|tras|ante|bajo|contra|entre|segun|todo|todos|toda|todas|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|aquellos|aquellas|mismo|misma|mismos|mismas|otro|otra|otros|otras|nuevo|nueva|nuevos|nuevas|gran|grande|grandes|mejor|peor|mayor|menor|primer|primera|ultimo|ultima)\b/gi;

    let cleaned = topic
      .replace(/\b\w+'(?:s|re|ve|ll|d|m|t)\b/gi, " ")
      .replace(fillers, " ")
      .trim();

    cleaned = cleaned
      .replace(/[^\w\s#@]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length < 2) {
      const allWords = topic.match(/\b\w{3,}\b/g);
      if (allWords?.length) return allWords.slice(0, 3).join(" ");
      return topic;
    }

    const words = cleaned.split(" ").filter((w) => w.length > 1);
    if (words.length > 3) {
      return words.slice(-3).join(" ");
    }

    return cleaned;
  }
}
