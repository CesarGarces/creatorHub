import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@creator-hub/database";

/**
 * Read model for the creator's community conversations (fan ↔ bot
 * messages across all their channels).
 */
@Injectable()
export class ConversationService {
  async listConversations(userId: string, page: number, limit: number) {
    const where = { channel: { userId } };

    const [total, conversations] = await prisma.$transaction([
      prisma.communityConversation.count({ where }),
      prisma.communityConversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contact: {
            select: {
              externalId: true,
              username: true,
              displayName: true,
              isBlocked: true,
            },
          },
          channel: { select: { type: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              content: true,
              direction: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      data: conversations,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listMessages(
    userId: string,
    conversationId: string,
    page: number,
    limit: number,
  ) {
    const conversation = await prisma.communityConversation.findFirst({
      where: { id: conversationId, channel: { userId } },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const [total, messages] = await prisma.$transaction([
      prisma.communityMessage.count({ where: { conversationId } }),
      prisma.communityMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          direction: true,
          content: true,
          status: true,
          skipReason: true,
          modelId: true,
          creditsUsed: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      // Chronological order for the UI thread view
      data: messages.reverse(),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
