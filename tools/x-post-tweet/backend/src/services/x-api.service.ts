import { Injectable, BadRequestException } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";

interface PublishTweetResponse {
  id: string;
  text: string;
  edit_history_tweet_ids: string[];
}

@Injectable()
export class XApiService {
  private logger = new Logger("XApiService");
  private readonly API_BASE = "https://api.twitter.com/2";
  private readonly isMock = process.env.NODE_ENV !== "production";

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

    if (this.isMock) {
      return this.mockPublishTweet(text);
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
    if (this.isMock) {
      this.logger.warn("[MOCK] Deleting tweet (development mode)", {
        tweetId,
      });
      await new Promise((r) => setTimeout(r, 200));
      return;
    }

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
    if (this.isMock) {
      this.logger.warn("[MOCK] Getting tweet (development mode)", { tweetId });
      return {
        id: tweetId,
        text: "This is a mock tweet in development mode.",
        created_at: new Date().toISOString(),
      };
    }

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

  private async mockPublishTweet(text: string): Promise<PublishTweetResponse> {
    const mockId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.logger.warn("[MOCK] Publishing tweet (development mode)", {
      text: text.slice(0, 50),
    });

    await new Promise((r) => setTimeout(r, 500));

    return {
      id: mockId,
      text,
      edit_history_tweet_ids: [mockId],
    };
  }
}
