import { Injectable, BadRequestException } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";

interface ApifyRunOptions {
  topic: string;
  maxTweets?: number;
  timeframe?: string;
  language?: string;
  includeReplies?: boolean;
  sortBy?: string;
}

interface ApifyTweet {
  id: string;
  text: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    name: string;
    verified: boolean;
    followers: number;
  };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views?: number;
  };
  hashtags: string[];
  urls?: string[];
  media?: string[];
}

@Injectable()
export class ApifyService {
  private logger = new Logger("ApifyService");
  private readonly API_BASE = "https://api.apify.com/v2";

  async searchTweets(options: ApifyRunOptions): Promise<ApifyTweet[]> {
    const apiToken = process.env.APIFY_API_TOKEN;
    const actorId =
      process.env.APIFY_TWITTER_ACTOR_ID || "apidojo/tweet-scraper";

    if (!apiToken) {
      this.logger.error("APIFY_API_TOKEN is not configured");
      throw new BadRequestException(
        "Apify API token is not configured. Please add APIFY_API_TOKEN to your .env file. Get your token at https://console.apify.com/account/integrations",
      );
    }

    const maxItems = Math.max(options.maxTweets || 50, 10);

    // Build input according to apidojo/twitter-scraper-lite actor schema
    // See: https://apify.com/apidojo/twitter-scraper-lite
    const input: Record<string, any> = {
      searchTerms: [options.topic],
      sort: "Latest",
      maxItems,
    };

    // Add optional filters
    if (options.language) {
      input.tweetLanguage = options.language;
    }

    // Add date range if timeframe is specified
    if (options.timeframe) {
      const now = new Date();
      let startDate: Date | null = null;

      switch (options.timeframe) {
        case "24h":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
      }

      if (startDate) {
        input.start = startDate.toISOString().split("T")[0];
      }
    }

    this.logger.info("Starting Apify run", { actorId, topic: options.topic });

    const actorIdForUrl = actorId.replace("/", "~");
    const runResponse = await fetch(
      `${this.API_BASE}/acts/${actorIdForUrl}/runs?token=${apiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      this.logger.error("Failed to start Apify run", {
        status: runResponse.status,
        statusText: runResponse.statusText,
        error: errorText,
        actorId,
      });

      if (runResponse.status === 401) {
        throw new BadRequestException(
          "Invalid Apify API token. Please check your APIFY_API_TOKEN in .env file.",
        );
      }

      if (runResponse.status === 404) {
        throw new BadRequestException(
          `Apify actor "${actorId}" not found. Please check APIFY_TWITTER_ACTOR_ID in .env file.`,
        );
      }

      throw new BadRequestException(
        `Failed to start Apify search: ${runResponse.status} ${runResponse.statusText}`,
      );
    }

    const runData = (await runResponse.json()) as {
      data: { id: string; status: string; defaultDatasetId: string };
    };
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;

    this.logger.info("Apify run started", { runId, datasetId });

    const maxWaitTime = 60000;
    const pollInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const statusResponse = await fetch(
        `${this.API_BASE}/acts/${actorIdForUrl}/runs/${runId}?token=${apiToken}`,
      );

      if (!statusResponse.ok) {
        continue;
      }

      const statusData = (await statusResponse.json()) as {
        data: { status: string };
      };
      const status = statusData.data.status;

      if (status === "SUCCEEDED") {
        this.logger.info("Apify run completed", { runId });
        break;
      }

      if (
        status === "FAILED" ||
        status === "ABORTED" ||
        status === "TIMED-OUT"
      ) {
        this.logger.error("Apify run failed", { runId, status });
        throw new BadRequestException(
          `Apify search failed with status: ${status}`,
        );
      }
    }

    let datasetResponse: Response;
    try {
      const url = `${this.API_BASE}/datasets/${datasetId}/items?token=${apiToken}&format=json&limit=1000&clean=true`;
      this.logger.info("Fetching dataset items", {
        url: url.replace(apiToken, "***"),
        datasetId,
        runId,
      });
      datasetResponse = await fetch(url);
    } catch (fetchError) {
      this.logger.error("Network error fetching Apify dataset", {
        error: (fetchError as Error).message,
      });
      throw new BadRequestException(
        `Failed to fetch search results: ${(fetchError as Error).message}`,
      );
    }

    if (!datasetResponse.ok) {
      const error = await datasetResponse.text();
      this.logger.error("Failed to fetch Apify dataset", {
        status: datasetResponse.status,
        statusText: datasetResponse.statusText,
        error,
      });
      throw new BadRequestException(
        `Failed to fetch search results (HTTP ${datasetResponse.status}): ${error}`,
      );
    }

    const rawResponse = (await datasetResponse.json()) as any;

    this.logger.info("Raw dataset response", {
      type: typeof rawResponse,
      isArray: Array.isArray(rawResponse),
      keys:
        !Array.isArray(rawResponse) && rawResponse
          ? Object.keys(rawResponse)
          : [],
      sample: JSON.stringify(rawResponse).slice(0, 2000),
    });

    const items = Array.isArray(rawResponse)
      ? rawResponse
      : rawResponse?.items || rawResponse?.data || [];

    this.logger.info("Apify dataset processed", {
      topic: options.topic,
      rawType: typeof rawResponse,
      rawIsArray: Array.isArray(rawResponse),
      rawKeys:
        !Array.isArray(rawResponse) && rawResponse
          ? Object.keys(rawResponse)
          : [],
      itemCount: items.length,
      sampleItem:
        items.length > 0 ? JSON.stringify(items[0]).slice(0, 500) : null,
    });

    const normalized = this.normalizeTweets(items);

    this.logger.info("Apify search completed", {
      topic: options.topic,
      rawCount: items.length,
      normalizedCount: normalized.length,
    });

    return normalized;
  }

  private normalizeTweets(rawItems: any[]): ApifyTweet[] {
    if (!Array.isArray(rawItems)) {
      return [];
    }

    return rawItems
      .map((item, index) => {
        try {
          return {
            id: item.id || item.tweetId || item.id_str || `unknown_${index}`,
            text: item.text || item.full_text || item.content || "",
            createdAt:
              item.createdAt || item.created_at || item.timestamp || "",
            author: {
              id: item.author?.id || item.user?.id || item.authorId || "",
              username:
                item.author?.userName ||
                item.author?.username ||
                item.author?.screen_name ||
                item.user?.screen_name ||
                "unknown",
              name: item.author?.name || item.user?.name || "Unknown",
              verified:
                item.author?.isVerified ||
                item.author?.verified ||
                item.user?.verified ||
                false,
              followers:
                item.author?.followers || item.user?.followers_count || 0,
            },
            metrics: {
              likes:
                item.likeCount ||
                item.metrics?.likes ||
                item.favorite_count ||
                item.likes ||
                0,
              retweets:
                item.retweetCount ||
                item.metrics?.retweets ||
                item.retweet_count ||
                item.retweets ||
                0,
              replies:
                item.replyCount ||
                item.metrics?.replies ||
                item.reply_count ||
                item.replies ||
                0,
              quotes:
                item.quoteCount ||
                item.metrics?.quotes ||
                item.quote_count ||
                item.quotes ||
                0,
              views:
                item.viewCount || item.metrics?.views || item.views_count || 0,
            },
            hashtags:
              item.hashtags ||
              item.entities?.hashtags?.map((h: any) => h.text) ||
              [],
            urls:
              item.urls ||
              item.entities?.urls?.map((u: any) => u.expanded_url) ||
              [],
            media:
              item.media ||
              item.entities?.media?.map((m: any) => m.media_url) ||
              [],
          };
        } catch (error) {
          this.logger.warn("Failed to normalize tweet", {
            index,
            error: (error as Error).message,
          });
          return null;
        }
      })
      .filter(Boolean) as ApifyTweet[];
  }

  formatTweetsForAnalysis(tweets: ApifyTweet[]): string {
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

  private extractTrendingHashtags(tweets: ApifyTweet[]): string[] {
    const hashtagCounts = new Map<string, number>();

    tweets.forEach((tweet) => {
      tweet.hashtags.forEach((tag) => {
        const normalized = tag.toLowerCase().replace(/^#/, "");
        hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1);
      });
    });

    return Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => `#${tag}`);
  }
}
