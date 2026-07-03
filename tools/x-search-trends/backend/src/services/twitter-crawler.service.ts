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
   * Search tweets using Crawlee + Playwright (browser scraping)
   * This is a fallback when X API is not available (free plan)
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

    try {
      // Dynamic import to avoid issues in test environments
      const { PlaywrightCrawler } = await import("crawlee");

      const maxResults = Math.min(options.maxResults || 50, 100);
      const tweets: CrawledTweet[] = [];

      // Build search URL
      let searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=top`;

      // Add language filter if specified
      if (options.language) {
        const langQuery = `${query} lang:${options.language}`;
        searchUrl = `https://x.com/search?q=${encodeURIComponent(langQuery)}&src=typed_query&f=top`;
      }

      this.logger.info("Crawling Twitter search", { url: searchUrl });

      const crawler = new PlaywrightCrawler({
        headless: true,
        navigationTimeoutSecs: 30,
        requestHandlerTimeoutSecs: 60,
        maxConcurrency: 1,
        maxRequestRetries: 2,

        async requestHandler({ page, request }) {
          // Navigate and wait for content
          await page.waitForTimeout(3000);

          // Check if we're on login page
          const currentUrl = page.url();
          if (
            currentUrl.includes("login") ||
            currentUrl.includes("onboarding")
          ) {
            // Twitter requires login for search - try to extract what we can from the page
            console.log("Redirected to login page - extracting public content");
          }

          // Try to extract tweets from the page
          const pageTweets = await page.evaluate(() => {
            const results: any[] = [];

            // Look for article elements (Twitter uses these for tweets)
            const articles = document.querySelectorAll("article");
            for (const article of articles) {
              const text = article.innerText;
              if (text && text.length > 20) {
                // Try to extract username
                const usernameMatch = text.match(/@(\w+)/);
                const username = usernameMatch ? usernameMatch[1] : "unknown";

                // Try to extract metrics
                const likesMatch = text.match(
                  /(\d+(?:\.\d+)?[KkMm]?)\s*(?:likes?|❤️)/i,
                );
                const retweetsMatch = text.match(
                  /(\d+(?:\.\d+)?[KkMm]?)\s*(?:retweets?|🔁)/i,
                );

                results.push({
                  text: text.substring(0, 500),
                  username,
                  likes: likesMatch ? likesMatch[1] : "0",
                  retweets: retweetsMatch ? retweetsMatch[1] : "0",
                });
              }
            }

            return results;
          });

          // Transform to our format
          for (const tweet of pageTweets) {
            if (tweets.length >= maxResults) break;

            tweets.push({
              id: `crawled_${Date.now()}_${tweets.length}`,
              text: tweet.text,
              createdAt: new Date().toISOString(),
              author: {
                id: "",
                username: tweet.username,
                name: tweet.username,
                verified: false,
                followers: 0,
              },
              metrics: {
                likes: parseMetric(tweet.likes),
                retweets: parseMetric(tweet.retweets),
                replies: 0,
                quotes: 0,
                views: 0,
              },
              hashtags: extractHashtags(tweet.text),
              urls: extractUrls(tweet.text),
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
