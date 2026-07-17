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
const MIN_TWEETS_FOR_ANALYSIS = 5;

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
  insufficientData: boolean;
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
    title?: string,
  ): Promise<SearchResult & { sessionId: string }> {
    if (!options.topic?.trim()) {
      throw new BadRequestException("Topic is required");
    }

    const session = await this.socialResearch.getOrCreateSession(
      userId,
      "x-search-trends",
      sessionId,
      title,
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

    // Build search queries using AI
    const queries = await this.buildSearchQueries(options.topic);
    this.logger.info("Generated search queries", { queries });

    // Search with multiple queries for better coverage
    let allTweets: SearchResultTweet[] = [];
    let usedFallback = false;

    for (const query of queries) {
      if (allTweets.length >= 20) break;

      try {
        const account = await this.socialService.getActiveAccountByProvider(
          userId,
          "X_TWITTER",
        );

        if (!account) {
          throw new BadRequestException(
            "No X account connected. Please connect your X account in Settings.",
          );
        }

        const accessToken = this.encryptionService.decrypt(account.accessToken);

        let searchQuery = query;
        if (options.language) {
          searchQuery += ` lang:${options.language}`;
        }
        if (!options.includeReplies) {
          searchQuery += " -is:reply";
        }

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

        const searchResult = await this.xApiService.searchTweets(
          accessToken,
          searchQuery,
          {
            maxResults: 100,
            startTime,
          },
        );

        allTweets.push(...searchResult.tweets);
      } catch (error) {
        const message = (error as Error).message || "";

        // Token expired - tell user to reconnect
        if (
          message.includes("401") ||
          message.includes("Unauthorized") ||
          message.includes("authorization expired")
        ) {
          throw new BadRequestException(
            "Your X account connection has expired. Please disconnect and reconnect your X account in Settings.",
          );
        }

        this.logger.warn("X API search failed for query", {
          query,
          error: message,
        });
      }
    }

    // Deduplicate tweets by ID
    const seenIds = new Set<string>();
    allTweets = allTweets.filter((t) => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });

    // If no results from X API, try Crawlee as fallback
    if (allTweets.length === 0) {
      this.logger.info("X API returned 0 results, trying Crawlee fallback", {
        userId,
        topic: options.topic,
      });

      usedFallback = true;
      try {
        const crawledTweets = await this.twitterCrawler.searchTweets(
          options.topic,
          {
            maxResults: 100,
            timeframe: options.timeframe,
            language: options.language,
          },
        );

        allTweets = crawledTweets.map((t) => ({
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
        this.logger.error("Crawlee fallback failed", {
          error: (crawlerError as Error).message,
        });
      }
    }

    // Filter and analyze tweets
    const originalTweetCount = allTweets.length;
    const filteredTweets = this.tweetAnalysis.filterTweets(allTweets);

    this.logger.info("Tweets filtered", {
      original: originalTweetCount,
      filtered: filteredTweets.length,
    });

    // Check if we have enough data for meaningful analysis
    const insufficientData = filteredTweets.length < MIN_TWEETS_FOR_ANALYSIS;

    // Generate analysis
    let analysis: TweetAnalysis;
    let formattedAnalysis: string;

    if (insufficientData) {
      // Not enough data - provide helpful message
      analysis = this.generateInsufficientDataAnalysis(
        options.topic,
        filteredTweets,
      );
      formattedAnalysis = this.formatInsufficientDataAnalysis(
        options.topic,
        originalTweetCount,
        filteredTweets,
      );
    } else {
      // Enough data - generate full analysis
      try {
        analysis = await this.generateAIAnalysis(options.topic, filteredTweets);
      } catch (error) {
        this.logger.warn("AI analysis failed, using basic analysis", {
          error: (error as Error).message,
        });
        analysis = this.generateBasicAnalysis(filteredTweets);
      }

      formattedAnalysis = this.formatAnalysis(
        options.topic,
        filteredTweets,
        analysis,
      );
    }

    const trendingHashtags = this.extractTrendingHashtags(filteredTweets);

    const result: SearchResult = {
      topic: options.topic,
      tweetCount: filteredTweets.length,
      originalTweetCount,
      tweets: filteredTweets.slice(0, 20),
      trendingHashtags,
      formattedAnalysis,
      analysis,
      fromCache: false,
      insufficientData,
    };

    // Only cache if we have good results
    if (filteredTweets.length >= MIN_TWEETS_FOR_ANALYSIS) {
      await this.cacheService.set(options.topic, CACHE_PROVIDER, result);
    }

    // Deduct credits (single transaction for search + AI analysis)
    const creditsToDeduct = insufficientData
      ? SEARCH_CREDIT_COST
      : totalCreditsNeeded;
    await this.creditService.deduct(
      userId,
      creditsToDeduct,
      "x-search-trends",
      `X trend search: ${options.topic}${usedFallback ? " (via Crawlee)" : ""}`,
    );

    await this.socialResearch.addMessage(session.id, {
      role: "assistant",
      content: formattedAnalysis,
      resultData: result,
      provider: "x",
      creditsUsed: insufficientData ? SEARCH_CREDIT_COST : totalCreditsNeeded,
      cacheHit: false,
    });

    this.logger.info("X trend search completed", {
      userId,
      topic: options.topic,
      originalCount: originalTweetCount,
      filteredCount: filteredTweets.length,
      insufficientData,
    });

    return { ...result, sessionId: session.id };
  }

  /**
   * Use AI to transform user's natural language into X search queries
   * This works for any language and topic
   */
  private async buildSearchQueries(topic: string): Promise<string[]> {
    try {
      const prompt = `Convert this to a Twitter/X search query. Return ONLY the query words, nothing else.

User said: "${topic}"

Example outputs:
- "gaming"
- "crypto"
- "inteligencia artificial"
- "startup funding"

Return JSON: {"queries": ["query"]}`;

      const response = await this.aiEngine.execute({
        taskType: "text-generation",
        prompt,
        parameters: {
          temperature: 0,
          maxTokens: 50,
        },
      });

      let text = "";
      if (response.output.type === "json") {
        const data = response.output.data as { queries?: string[] };
        if (data.queries?.length) return data.queries.slice(0, 2);
      } else if (response.output.type === "text") {
        text = response.output.content;
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { queries?: string[] };
        if (parsed.queries?.length) return parsed.queries.slice(0, 2);
      }
    } catch (error) {
      this.logger.warn("AI query generation failed", {
        error: (error as Error).message,
      });
    }

    return [topic.substring(0, 30)];
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
          `@${t.author.username} (${t.author.followers.toLocaleString()} followers, verified: ${t.author.verified}):
"${t.text.substring(0, 200)}"
Engagement: ${t.metrics.likes} likes, ${t.metrics.retweets} RTs`,
      )
      .join("\n\n");

    const prompt = `You are an expert social media trend analyst. Analyze these tweets about "${topic}".

IMPORTANT RULES:
1. Only identify themes that are ACTUALLY mentioned in the tweets
2. Do NOT guess or infer themes not present
3. If there are few tweets, say "Limited data available" in your summary
4. Be specific about what people are actually discussing
5. Focus on REAL trends, not individual tweets

Tweets to analyze:
${tweetData}

Return ONLY valid JSON (no markdown, no explanation):
{"executiveSummary":"2-3 sentence summary of actual trends","themes":[{"name":"Specific Theme","description":"What people are actually discussing","tweetCount":1,"sentiment":"positive"}],"overallSentiment":"positive","keyInfluencers":[{"username":"user","name":"Name","followers":1000,"verified":false,"tweetCount":1}]}`;

    const response = await this.aiEngine.execute({
      taskType: "text-generation",
      prompt,
      parameters: {
        temperature: 0.2,
        maxTokens: 1000,
      },
    });

    // Try to parse JSON from the response
    let parsed: TweetAnalysis | null = null;

    if (response.output.type === "json") {
      parsed = response.output.data as unknown as TweetAnalysis;
    } else if (response.output.type === "text") {
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
   * Generate analysis when there's insufficient data
   */
  private generateInsufficientDataAnalysis(
    topic: string,
    tweets: FilteredTweet[],
  ): TweetAnalysis {
    const themeCounts = new Map<string, number>();
    tweets.forEach((t) =>
      t.themes.forEach((theme) =>
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1),
      ),
    );

    const sentiments = { positive: 0, negative: 0, neutral: 0 };
    tweets.forEach((t) => sentiments[t.sentiment]++);

    const overallSentiment =
      sentiments.positive > sentiments.negative
        ? "positive"
        : sentiments.negative > sentiments.positive
          ? "negative"
          : "neutral";

    return {
      executiveSummary: `Limited data available for "${topic}". The search found some relevant content but not enough for a comprehensive trend analysis. Try broadening your search terms or checking back later for more data.`,
      themes: Array.from(themeCounts.entries()).map(([name, count]) => ({
        name,
        description: `Found ${count} related post${count > 1 ? "s" : ""}`,
        tweetCount: count,
        sentiment: "neutral" as const,
      })),
      overallSentiment,
      keyInfluencers: tweets.slice(0, 3).map((t) => ({
        username: t.author.username,
        name: t.author.name,
        followers: t.author.followers,
        verified: t.author.verified,
        tweetCount: 1,
      })),
      filteredTweetCount: tweets.length,
      originalTweetCount: tweets.length,
    };
  }

  /**
   * Generate basic analysis without AI
   */
  private generateBasicAnalysis(tweets: FilteredTweet[]): TweetAnalysis {
    const sentiments = { positive: 0, negative: 0, neutral: 0 };
    tweets.forEach((t) => sentiments[t.sentiment]++);

    const themeCounts = new Map<string, number>();
    tweets.forEach((t) =>
      t.themes.forEach((theme) =>
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1),
      ),
    );

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
      executiveSummary: `Analysis of ${tweets.length} relevant posts about this topic.`,
      themes: Array.from(themeCounts.entries()).map(([name, count]) => ({
        name,
        description: `Discussed in ${count} post${count > 1 ? "s" : ""}`,
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
        output += `${i + 1}. ${themeEmoji} **${theme.name}** (${theme.tweetCount} posts) - ${theme.description}\n`;
      });
      output += "\n";
    }

    // Key Influencers
    if (analysis.keyInfluencers.length > 0) {
      output += `## Key Influencers\n`;
      analysis.keyInfluencers.forEach((inf, i) => {
        const verified = inf.verified ? " ✓" : "";
        output += `${i + 1}. @${inf.username}${verified} (${inf.followers.toLocaleString()} followers) - ${inf.tweetCount} post${inf.tweetCount > 1 ? "s" : ""}\n`;
      });
      output += "\n";
    }

    // Top Tweets (filtered)
    const topTweets = tweets.slice(0, 10);
    if (topTweets.length > 0) {
      output += `## Top Posts\n\n`;
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

  /**
   * Format analysis when there's insufficient data
   */
  private formatInsufficientDataAnalysis(
    topic: string,
    originalCount: number,
    tweets: FilteredTweet[],
  ): string {
    let output = `# Trend Analysis: ${topic}\n\n`;

    output += `## ⚠️ Limited Data Available\n\n`;
    output += `The search found ${originalCount} post${originalCount !== 1 ? "s" : ""} about "${topic}", but this isn't enough for a comprehensive trend analysis.\n\n`;

    output += `### Recommendations\n`;
    output += `- Try broader search terms (e.g., "crypto" instead of "crypto news today")\n`;
    output += `- Check back later when more content is available\n`;
    output += `- Try different timeframes (7d or 30d)\n\n`;

    // Still show what we found if anything
    if (tweets.length > 0) {
      output += `### What We Found\n\n`;
      tweets.slice(0, 5).forEach((tweet, i) => {
        const engagement =
          tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies;
        output += `**@${tweet.author.username}** (${tweet.author.followers.toLocaleString()} followers)\n`;
        output += `> ${tweet.text.substring(0, 150)}${tweet.text.length > 150 ? "..." : ""}\n`;
        output += `[View on X →](https://x.com/${tweet.author.username}/status/${tweet.id})\n\n`;
      });
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
}
