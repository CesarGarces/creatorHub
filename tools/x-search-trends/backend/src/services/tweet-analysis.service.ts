import { Injectable } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import type { SearchResultTweet } from "@creator-hub/x-post-tweet-backend";

// Spam/NSFW keywords to filter out
const SPAM_KEYWORDS = [
  "findom",
  "betting",
  "casino",
  "xxx",
  "porn",
  "nude",
  "nsfw",
  "sex",
  "fetish",
  "escort",
  "sugar daddy",
  "onlyfans",
  "crypto signal",
  "guaranteed returns",
  "100x gem",
  "moon shot",
  "pump and dump",
  "whalesub",
  "bigblackcock",
  "interracial",
  "cuckold",
  "queenofspades",
  "bnwobull",
  "bbconly",
  "blacked",
  "bnwo",
  "bbcaddict",
  "bbcbigooner",
];

// Minimum follower count for authority (unless high engagement)
const MIN_FOLLOWERS = 500;
const HIGH_ENGAGEMENT_THRESHOLD = 100;

export interface FilteredTweet extends SearchResultTweet {
  authority: "high" | "medium" | "low";
  sentiment: "positive" | "negative" | "neutral";
  themes: string[];
  isSpam: boolean;
}

export interface TweetAnalysis {
  executiveSummary: string;
  themes: Array<{
    name: string;
    description: string;
    tweetCount: number;
    sentiment: "positive" | "negative" | "neutral";
  }>;
  overallSentiment: "positive" | "negative" | "neutral";
  keyInfluencers: Array<{
    username: string;
    name: string;
    followers: number;
    verified: boolean;
    tweetCount: number;
  }>;
  filteredTweetCount: number;
  originalTweetCount: number;
}

@Injectable()
export class TweetAnalysisService {
  private logger = new Logger("TweetAnalysisService");

  /**
   * Filter and analyze tweets for quality and relevance
   */
  filterTweets(tweets: SearchResultTweet[]): FilteredTweet[] {
    this.logger.info("Filtering tweets", { count: tweets.length });

    return tweets
      .map((tweet) => ({
        ...tweet,
        ...this.analyzeSingleTweet(tweet),
      }))
      .filter((tweet) => {
        // Remove spam
        if (tweet.isSpam) {
          this.logger.debug("Filtered spam tweet", {
            id: tweet.id,
            username: tweet.author.username,
          });
          return false;
        }

        // Remove low authority accounts (unless high engagement)
        const engagement =
          tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies;
        if (
          tweet.author.followers < MIN_FOLLOWERS &&
          engagement < HIGH_ENGAGEMENT_THRESHOLD
        ) {
          this.logger.debug("Filtered low authority tweet", {
            id: tweet.id,
            username: tweet.author.username,
            followers: tweet.author.followers,
          });
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by authority and engagement
        const aScore = this.calculateTweetScore(a);
        const bScore = this.calculateTweetScore(b);
        return bScore - aScore;
      });
  }

  /**
   * Analyze a single tweet for spam, sentiment, and themes
   */
  private analyzeSingleTweet(
    tweet: SearchResultTweet,
  ): Omit<FilteredTweet, keyof SearchResultTweet> {
    const text = tweet.text.toLowerCase();

    // Check for spam
    const isSpam = SPAM_KEYWORDS.some((keyword) =>
      text.includes(keyword.toLowerCase()),
    );

    // Determine authority level
    let authority: "high" | "medium" | "low" = "low";
    if (tweet.author.verified || tweet.author.followers >= 10000) {
      authority = "high";
    } else if (tweet.author.followers >= MIN_FOLLOWERS) {
      authority = "medium";
    }

    // Simple sentiment analysis
    const sentiment = this.analyzeSentiment(text);

    // Extract themes
    const themes = this.extractThemes(tweet);

    return {
      authority,
      sentiment,
      themes,
      isSpam,
    };
  }

  /**
   * Simple sentiment analysis based on keywords
   */
  private analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
    const positiveWords = [
      "bullish",
      "moon",
      "pump",
      "great",
      "amazing",
      "love",
      "best",
      "win",
      "gain",
      "profit",
      "success",
      "breakout",
      "rally",
      "surge",
      "soar",
    ];

    const negativeWords = [
      "bearish",
      "crash",
      "dump",
      "scam",
      "fraud",
      "hack",
      "lose",
      "loss",
      "fail",
      "dead",
      "collapse",
      "plunge",
      "tank",
      "bubble",
      "ponzi",
    ];

    const positiveCount = positiveWords.filter((w) => text.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => text.includes(w)).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  /**
   * Extract themes from tweet content
   */
  private extractThemes(tweet: SearchResultTweet): string[] {
    const themes: string[] = [];
    const text = tweet.text.toLowerCase();

    // Theme detection based on content
    const themePatterns: Record<string, string[]> = {
      DeFi: ["defi", "uniswap", "aave", "compound", "yield", "liquidity"],
      NFT: ["nft", "opensea", "collection", "mint", "art"],
      Bitcoin: ["bitcoin", "btc", "satoshi"],
      Ethereum: ["ethereum", "eth", "vitalik", "layer 2", "l2"],
      AI: ["ai", "artificial intelligence", "gpt", "llm", "machine learning"],
      Regulation: ["regulation", "sec", "lawsuit", "legal", "compliance"],
      Trading: [
        "trading",
        "chart",
        "technical analysis",
        "support",
        "resistance",
      ],
      Gaming: ["gaming", "play to earn", "p2e", "metaverse"],
    };

    for (const [theme, keywords] of Object.entries(themePatterns)) {
      if (keywords.some((kw) => text.includes(kw))) {
        themes.push(theme);
      }
    }

    // Add hashtags as themes
    tweet.hashtags.forEach((tag) => {
      const normalized = tag.toLowerCase();
      if (!themes.includes(normalized)) {
        themes.push(normalized);
      }
    });

    return themes.length > 0 ? themes : ["general"];
  }

  /**
   * Calculate a quality score for sorting
   */
  private calculateTweetScore(tweet: FilteredTweet): number {
    let score = 0;

    // Authority weight
    if (tweet.authority === "high") score += 100;
    else if (tweet.authority === "medium") score += 50;

    // Verified bonus
    if (tweet.author.verified) score += 50;

    // Follower count (logarithmic scale)
    score += Math.log10(Math.max(tweet.author.followers, 1)) * 10;

    // Engagement
    score += tweet.metrics.likes * 2;
    score += tweet.metrics.retweets * 3;
    score += tweet.metrics.replies;

    // Sentiment bonus
    if (tweet.sentiment === "positive") score += 10;

    return score;
  }
}
