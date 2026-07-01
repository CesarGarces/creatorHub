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

interface ApifyRunResult {
  id: string;
  status: string;
  items: ApifyTweet[];
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

    const maxTweets = options.maxTweets || 20;
    const timeframe = options.timeframe || "24h";

    const input = {
      searchTerms: [options.topic],
      maxTweets: maxTweets,
      maxTweetsPerQuery: maxTweets,
      onlyVerifiedUsers: false,
      onlyTwitterBlue: false,
      author: "",
      inReplyTo: "",
      mentioning: "",
      includeSearchTerms: true,
      tweetLanguage: options.language || "en",
    };

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
          `Apify actor "${actorId}" not found. Please check APIFY_TWITTER_ACTOR_ID in .env file. Available actors: apidojo/tweet-scraper, clockworks/twitter-scraper`,
        );
      }

      throw new BadRequestException(
        `Failed to start Apify search: ${runResponse.status} ${runResponse.statusText}`,
      );
    }

    const runData = (await runResponse.json()) as {
      data: { id: string; status: string };
    };
    const runId = runData.data.id;

    this.logger.info("Apify run started", { runId });

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

    const datasetResponse = await fetch(
      `${this.API_BASE}/acts/${actorIdForUrl}/runs/${runId}/dataset/items?token=${apiToken}&format=json`,
    );

    if (!datasetResponse.ok) {
      const error = await datasetResponse.text();
      this.logger.error("Failed to fetch Apify dataset", { error });
      throw new BadRequestException("Failed to fetch search results");
    }

    const items = (await datasetResponse.json()) as ApifyTweet[];

    this.logger.info("Apify search completed", {
      topic: options.topic,
      tweetCount: items.length,
    });

    return items;
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
