import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class TrendCacheService {
  private logger = new Logger("TrendCacheService");

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private generateHash(query: string): string {
    const normalized = this.normalizeQuery(query);
    return createHash("sha256").update(normalized).digest("hex");
  }

  async get(
    query: string,
    provider: string,
  ): Promise<Record<string, any> | null> {
    const hash = this.generateHash(query);

    const cached = await prisma.trendCache.findUnique({
      where: {
        queryHash_provider: {
          queryHash: hash,
          provider,
        },
      },
    });

    if (!cached) return null;

    if (cached.expiresAt < new Date()) {
      await prisma.trendCache.delete({
        where: {
          queryHash_provider: {
            queryHash: hash,
            provider,
          },
        },
      });
      this.logger.info("Cache expired", {
        query: query.slice(0, 50),
        provider,
      });
      return null;
    }

    await prisma.trendCache.update({
      where: {
        queryHash_provider: {
          queryHash: hash,
          provider,
        },
      },
      data: { hitCount: { increment: 1 } },
    });

    this.logger.info("Cache hit", {
      query: query.slice(0, 50),
      provider,
      hitCount: cached.hitCount + 1,
    });

    return cached.resultData as Record<string, any>;
  }

  async set(
    query: string,
    provider: string,
    resultData: Record<string, any>,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<void> {
    const hash = this.generateHash(query);
    const expiresAt = new Date(Date.now() + ttlMs);

    await prisma.trendCache.upsert({
      where: {
        queryHash_provider: {
          queryHash: hash,
          provider,
        },
      },
      create: {
        queryHash: hash,
        provider,
        resultData,
        expiresAt,
      },
      update: {
        resultData,
        expiresAt,
        hitCount: 0,
      },
    });

    this.logger.info("Cache set", {
      query: query.slice(0, 50),
      provider,
      expiresAt,
    });
  }

  async cleanup(): Promise<number> {
    const result = await prisma.trendCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.info("Cleaned up expired cache entries", {
        count: result.count,
      });
    }

    return result.count;
  }
}
