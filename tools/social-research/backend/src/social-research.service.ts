import { Injectable } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import { TrendCacheService } from "./cache.service";

export type ResearchRole = "user" | "assistant";

export interface ResearchMessage {
  id: string;
  role: ResearchRole;
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

// Prisma proxy export doesn't expose new model properties through TS inference
let _prisma: any;
function getPrisma(): any {
  if (!_prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const db = require("@creator-hub/database");
    _prisma = db.prisma;
  }
  return _prisma;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessage(msg: any): ResearchMessage {
  return {
    id: msg.id,
    role: msg.role as ResearchRole,
    content: msg.content,
    resultData: msg.resultData,
    provider: msg.provider,
    creditsUsed: msg.creditsUsed,
    cacheHit: msg.cacheHit,
    createdAt: msg.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSession(session: any): ResearchSession {
  return {
    id: session.id,
    toolId: session.toolId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages ? session.messages.map(mapMessage) : [],
    _count: session._count,
  };
}

@Injectable()
export class SocialResearchService {
  private logger = new Logger("SocialResearchService");

  constructor(private cacheService: TrendCacheService) {}

  async getOrCreateSession(
    userId: string,
    toolId: string,
    sessionId?: string,
    title?: string,
  ): Promise<ResearchSession> {
    const p = getPrisma();

    if (sessionId) {
      const existing = await p.socialResearchSession.findFirst({
        where: { id: sessionId, userId, toolId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (existing) {
        if (!existing.title && title?.trim()) {
          await p.socialResearchSession.update({
            where: { id: sessionId },
            data: { title: title.trim() },
          });
          existing.title = title.trim();
        }
        return mapSession(existing);
      }
    }

    const session = await p.socialResearchSession.create({
      data: {
        userId,
        toolId,
        title: title?.trim() || null,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return mapSession(session);
  }

  async getUserSessions(
    userId: string,
    toolId: string,
  ): Promise<ResearchSession[]> {
    const p = getPrisma();
    const sessions = await p.socialResearchSession.findMany({
      where: { userId, toolId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return sessions.map(mapSession);
  }

  async addMessage(
    sessionId: string,
    data: {
      role: "user" | "assistant";
      content: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resultData?: Record<string, any>;
      provider?: string;
      creditsUsed?: number;
      cacheHit?: boolean;
    },
  ): Promise<ResearchMessage> {
    const p = getPrisma();

    const message = await p.socialResearchMessage.create({
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

    await p.socialResearchSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return mapMessage(message);
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const p = getPrisma();
    const result = await p.socialResearchSession.deleteMany({
      where: { id: sessionId, userId },
    });
    return result.count > 0;
  }

  async updateSessionTitle(
    sessionId: string,
    userId: string,
    title: string,
  ): Promise<void> {
    const p = getPrisma();
    await p.socialResearchSession.updateMany({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resultData: Record<string, any>,
    ttlMs?: number,
  ): Promise<void> {
    await this.cacheService.set(query, provider, resultData, ttlMs);
  }
}
