import { Injectable, BadRequestException } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";

interface PublishTweetResponse {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
}

export interface SearchResultTweet {
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

export interface SearchResult {
  tweets: SearchResultTweet[];
  query: string;
  count: number;
  nextToken?: string;
}

@Injectable()
export class XApiService {
  private logger = new Logger("XApiService");
  private readonly API_BASE = "https://api.twitter.com/2";

  async publishTweet(
    accessToken: string,
    text: string,
  ): Promise<PublishTweetResponse> {
    if (!text?.trim()) {
      throw new BadRequestException("Tweet text is required");
    }

    if (text.length > 280) {
      throw new BadRequestException("Tweet exceeds 280 characters");
    }

    this.logger.info("Publishing tweet to X API");

    const response = await fetch(`${this.API_BASE}/tweets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error("Failed to publish tweet", {
        error,
        status: response.status,
      });

      if (response.status === 401 || response.status === 403) {
        throw new BadRequestException(
          "X account authorization expired. Please reconnect your account.",
        );
      }

      if (response.status === 429) {
        throw new BadRequestException(
          "X API rate limit exceeded. Please try again later.",
        );
      }

      throw new BadRequestException(`Failed to publish tweet: ${error}`);
    }

    const data = (await response.json()) as { data: PublishTweetResponse };

    this.logger.info("Tweet published successfully", {
      tweetId: data.data.id,
      textLength: text.length,
    });

    return data.data;
  }

  async deleteTweet(accessToken: string, tweetId: string): Promise<void> {
    this.logger.info("Deleting tweet from X API", { tweetId });

    const response = await fetch(`${this.API_BASE}/tweets/${tweetId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error("Failed to delete tweet", { error, tweetId });
      throw new BadRequestException(`Failed to delete tweet: ${error}`);
    }

    this.logger.info("Tweet deleted successfully", { tweetId });
  }

  async getTweet(accessToken: string, tweetId: string): Promise<any> {
    this.logger.info("Fetching tweet from X API", { tweetId });

    const response = await fetch(`${this.API_BASE}/tweets/${tweetId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error("Failed to fetch tweet", { error, tweetId });
      throw new BadRequestException(`Failed to fetch tweet: ${error}`);
    }

    const data = (await response.json()) as { data: any };
    return data.data;
  }

  /**
   * Search recent tweets using X API v2
   * Requires tweet.read scope
   * Endpoint: GET /2/tweets/search/recent
   * Docs: https://developer.x.com/en/docs/twitter-api/tweets/search/api-reference/get-tweets-search-recent
   */
  async searchTweets(
    accessToken: string,
    query: string,
    options: {
      maxResults?: number;
      startTime?: string;
      endTime?: string;
      nextToken?: string;
      tweetFields?: string[];
      userFields?: string[];
      expansions?: string[];
    } = {},
  ): Promise<SearchResult> {
    this.logger.info("Searching tweets via X API", { query, options });

    const maxResults = Math.min(options.maxResults || 50, 100);

    // Build query parameters
    const params = new URLSearchParams({
      query,
      max_results: maxResults.toString(),
      "tweet.fields":
        options.tweetFields?.join(",") ||
        "created_at,public_metrics,entities,author_id",
      "user.fields":
        options.userFields?.join(",") ||
        "id,username,name,verified,public_metrics",
      expansions: options.expansions?.join(",") || "author_id",
    });

    // Add optional time range
    if (options.startTime) {
      params.set("start_time", options.startTime);
    }
    if (options.endTime) {
      params.set("end_time", options.endTime);
    }
    if (options.nextToken) {
      params.set("next_token", options.nextToken);
    }

    const url = `${this.API_BASE}/tweets/search/recent?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error("Failed to search tweets", {
        error,
        status: response.status,
        query,
      });

      if (response.status === 401 || response.status === 403) {
        throw new BadRequestException(
          "X account authorization expired. Please reconnect your account.",
        );
      }

      if (response.status === 429) {
        throw new BadRequestException(
          "X API rate limit exceeded. Please try again later.",
        );
      }

      throw new BadRequestException(`Failed to search tweets: ${error}`);
    }

    const data = (await response.json()) as {
      data?: Array<{
        id: string;
        text: string;
        created_at: string;
        author_id: string;
        public_metrics: {
          like_count: number;
          retweet_count: number;
          reply_count: number;
          quote_count: number;
          impression_count?: number;
        };
        entities?: {
          hashtags?: Array<{ tag: string }>;
          urls?: Array<{ expanded_url: string }>;
          media?: Array<{ media_key: string; type: string }>;
        };
      }>;
      includes?: {
        users?: Array<{
          id: string;
          username: string;
          name: string;
          verified: boolean;
          public_metrics: {
            followers_count: number;
          };
        }>;
      };
      meta?: {
        next_token?: string;
        result_count: number;
      };
    };

    // Build user lookup map
    const userMap = new Map<string, any>();
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        userMap.set(user.id, user);
      }
    }

    // Transform to our format
    const tweets: SearchResultTweet[] = (data.data || []).map((tweet) => {
      const user = userMap.get(tweet.author_id);
      return {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        author: {
          id: tweet.author_id,
          username: user?.username || "unknown",
          name: user?.name || "Unknown",
          verified: user?.verified || false,
          followers: user?.public_metrics?.followers_count || 0,
        },
        metrics: {
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
          quotes: tweet.public_metrics?.quote_count || 0,
          views: tweet.public_metrics?.impression_count || 0,
        },
        hashtags: tweet.entities?.hashtags?.map((h) => h.tag) || [],
        urls: tweet.entities?.urls?.map((u) => u.expanded_url) || [],
      };
    });

    this.logger.info("Tweets searched successfully", {
      query,
      count: tweets.length,
      hasMore: !!data.meta?.next_token,
    });

    return {
      tweets,
      query,
      count: data.meta?.result_count || tweets.length,
      nextToken: data.meta?.next_token,
    };
  }
}
