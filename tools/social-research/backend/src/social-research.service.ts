import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { TrendCacheService } from "./cache.service";

export interface ResearchMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  resultData?: Record<string, any> | null;
  provider?: string | null;
  creditsUsed: number;
  cacheHit: boolean;
  createdAt: Date;
}

export interface ResearchSession {
  id: string;
  toolId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: ResearchMessage[];
  _count?: { messages: number };
}

@Injectable()
export class SocialResearchService {
  private logger = new Logger("SocialResearchService");

  constructor(private cacheService: TrendCacheService) {}

  async getOrCreateSession(
    userId: string,
    toolId: string,
    sessionId?: string,
  ): Promise<ResearchSession> {
    if (sessionId) {
      const existing = await prisma.socialResearchSession.findFirst({
        where: { id: sessionId, userId, toolId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (existing) return existing;
    }

    const session = await prisma.socialResearchSession.create({
      data: {
        userId,
        toolId,
        title: null,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return session;
  }

  async getUserSessions(
    userId: string,
    toolId: string,
  ): Promise<ResearchSession[]> {
    return prisma.socialResearchSession.findMany({
      where: { userId, toolId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async addMessage(
    sessionId: string,
    data: {
      role: "user" | "assistant";
      content: string;
      resultData?: Record<string, any>;
      provider?: string;
      creditsUsed?: number;
      cacheHit?: boolean;
    },
  ): Promise<ResearchMessage> {
    const message = await prisma.socialResearchMessage.create({
      data: {
        sessionId,
        role: data.role,
        content: data.content,
        resultData: data.resultData ?? undefined,
        provider: data.provider ?? undefined,
        creditsUsed: data.creditsUsed ?? 0,
        cacheHit: data.cacheHit ?? false,
      },
    });

    await prisma.socialResearchSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await prisma.socialResearchSession.deleteMany({
      where: { id: sessionId, userId },
    });
    return result.count > 0;
  }

  async updateSessionTitle(
    sessionId: string,
    userId: string,
    title: string,
  ): Promise<void> {
    await prisma.socialResearchSession.updateMany({
      where: { id: sessionId, userId },
      data: { title },
    });
  }

  async getCachedResult(
    query: string,
    provider: string,
  ): Promise<Record<string, any> | null> {
    return this.cacheService.get(query, provider);
  }

  async setCachedResult(
    query: string,
    provider: string,
    resultData: Record<string, any>,
    ttlMs?: number,
  ): Promise<void> {
    await this.cacheService.set(query, provider, resultData, ttlMs);
  }
}
