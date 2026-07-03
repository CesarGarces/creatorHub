import { Injectable, BadRequestException } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";

export interface CrawledTweet {
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
export class TwitterCrawlerService {
  private logger = new Logger("TwitterCrawlerService");

  /**
   * Search tweets using Crawlee + Playwright with authenticated session
   * Requires TWITTER_AUTH_TOKEN and TWITTER_CT0 env vars
   */
  async searchTweets(
    query: string,
    options: {
      maxResults?: number;
      timeframe?: string;
      language?: string;
    } = {},
  ): Promise<CrawledTweet[]> {
    this.logger.info("Starting Crawlee Twitter search", { query, options });

    const authToken = process.env.X_AUTH_TOKEN;
    const ct0 = process.env.X_CT0;

    if (!authToken || !ct0) {
      throw new BadRequestException(
        "Twitter session cookies not configured. Set TWITTER_AUTH_TOKEN and TWITTER_CT0 environment variables.",
      );
    }

    try {
      const { PlaywrightCrawler } = await import("crawlee");

      const maxResults = Math.min(options.maxResults || 50, 100);
      const tweets: CrawledTweet[] = [];

      // Build search query
      let searchQuery = query;
      if (options.language) {
        searchQuery += ` lang:${options.language}`;
      }

      const searchUrl = `https://x.com/search?q=${encodeURIComponent(searchQuery)}&src=typed_query&f=top`;

      this.logger.info("Crawling Twitter search with auth", { url: searchUrl });

      const crawler = new PlaywrightCrawler({
        headless: true,
        navigationTimeoutSecs: 30,
        requestHandlerTimeoutSecs: 60,
        maxConcurrency: 1,
        maxRequestRetries: 2,

        async requestHandler({ page, request }) {
          // Set authentication cookies before navigation
          await page.context().addCookies([
            {
              name: "auth_token",
              value: authToken,
              domain: ".x.com",
              path: "/",
              httpOnly: true,
              secure: true,
              sameSite: "None",
            },
            {
              name: "ct0",
              value: ct0,
              domain: ".x.com",
              path: "/",
              httpOnly: false,
              secure: true,
              sameSite: "Lax",
            },
          ]);

          // Navigate to search
          await page.goto(request.url, { waitUntil: "networkidle" });
          await page.waitForTimeout(3000);

          // Check if we're on the search page (not login)
          const currentUrl = page.url();
          if (
            currentUrl.includes("login") ||
            currentUrl.includes("onboarding")
          ) {
            console.log("Still redirected to login - cookies may be expired");
            return;
          }

          // Extract tweets from the page
          const pageTweets = await page.evaluate(() => {
            const results: any[] = [];

            // Look for tweet articles
            const articles = document.querySelectorAll(
              'article[data-testid="tweet"]',
            );
            for (const article of articles) {
              const textEl = article.querySelector(
                '[data-testid="tweetText"]',
              ) as HTMLElement | null;
              const text = textEl?.innerText || "";
              if (!text || text.length < 10) continue;

              // Extract username
              const usernameEl = article.querySelector(
                'a[href*="/"] span',
              ) as HTMLElement | null;
              const username =
                usernameEl?.innerText?.replace("@", "") || "unknown";

              // Extract name
              const nameEl = article.querySelector(
                '[data-testid="User-Name"] span',
              ) as HTMLElement | null;
              const name = nameEl?.innerText || username;

              // Extract time
              const timeEl = article.querySelector("time");
              const createdAt =
                timeEl?.getAttribute("datetime") || new Date().toISOString();

              // Extract metrics
              const likesEl = article.querySelector(
                '[data-testid="like"] span',
              ) as HTMLElement | null;
              const retweetsEl = article.querySelector(
                '[data-testid="retweet"] span',
              ) as HTMLElement | null;
              const repliesEl = article.querySelector(
                '[data-testid="reply"] span',
              ) as HTMLElement | null;
              const viewsEl = article.querySelector(
                'a[href*="/analytics"] span',
              ) as HTMLElement | null;

              results.push({
                text,
                username,
                name,
                createdAt,
                likes: likesEl?.innerText || "0",
                retweets: retweetsEl?.innerText || "0",
                replies: repliesEl?.innerText || "0",
                views: viewsEl?.innerText || "0",
              });
            }

            return results;
          });

          // Transform to our format
          for (const tweet of pageTweets) {
            if (tweets.length >= maxResults) break;

            const hashtags = extractHashtags(tweet.text);
            const urls = extractUrls(tweet.text);

            tweets.push({
              id: `crawled_${Date.now()}_${tweets.length}`,
              text: tweet.text,
              createdAt: tweet.createdAt,
              author: {
                id: "",
                username: tweet.username,
                name: tweet.name,
                verified: false,
                followers: 0,
              },
              metrics: {
                likes: parseMetric(tweet.likes),
                retweets: parseMetric(tweet.retweets),
                replies: parseMetric(tweet.replies),
                quotes: 0,
                views: parseMetric(tweet.views),
              },
              hashtags,
              urls,
            });
          }
        },

        failedRequestHandler({ request, error }) {
          console.error(
            `Crawlee request failed: ${request.url}`,
            (error as Error).message,
          );
        },
      });

      await crawler.run([searchUrl]);

      this.logger.info("Crawlee search completed", {
        query,
        tweetCount: tweets.length,
      });

      return tweets;
    } catch (error) {
      this.logger.error("Crawlee search failed", {
        error: (error as Error).message,
        query,
      });
      throw new BadRequestException(
        `Failed to search tweets: ${(error as Error).message}`,
      );
    }
  }
}

// Helper functions
function parseMetric(value: string): number {
  if (!value) return 0;
  const clean = value.replace(/,/g, "").trim();
  if (clean.endsWith("K") || clean.endsWith("k")) {
    return Math.round(parseFloat(clean) * 1000);
  }
  if (clean.endsWith("M") || clean.endsWith("m")) {
    return Math.round(parseFloat(clean) * 1000000);
  }
  return parseInt(clean, 10) || 0;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#(\w+)/g);
  return matches ? matches.map((h) => h.substring(1)) : [];
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s]+/g);
  return matches || [];
}
