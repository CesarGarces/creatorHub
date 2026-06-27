import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import type { Prisma } from "@creator-hub/database";

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ChatHistoryService {
  private logger = new Logger("ChatHistoryService");

  async listSessions(userId: string): Promise<any[]> {
    return prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
      },
    });
  }

  async getSession(sessionId: string): Promise<any> {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }

    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await prisma.chatSession.delete({
      where: { id: sessionId },
    });
  }

  async appendMessage(
    sessionId: string,
    role: "user" | "assistant" | "system",
    content: string,
    toolCalls?: Record<string, unknown>[],
    tokensUsed?: number,
  ): Promise<any> {
    return prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
        toolCalls: (toolCalls as Prisma.InputJsonValue) || undefined,
        tokensUsed,
      },
    });
  }

  async getSessionMessageHistory(
    sessionId: string,
    limit = 20,
  ): Promise<Array<{ role: string; content: string }>> {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        role: true,
        content: true,
      },
    });

    return messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
    });
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  }
}
