import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma, NotificationType } from "@creator-hub/database";
import type { Prisma } from "@creator-hub/database";

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationService {
  /**
   * Create a new notification
   */
  async create(dto: CreateNotificationDto): Promise<NotificationResponse> {
    const notification = await prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        data: dto.data as Prisma.InputJsonValue,
      },
    });

    return notification;
  }

  /**
   * Get all notifications for a user (paginated)
   */
  async findAllByUser(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
  ): Promise<{
    notifications: NotificationResponse[];
    total: number;
    unreadCount: number;
  }> {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Get a single notification by ID
   */
  async findOne(id: string, userId: string): Promise<NotificationResponse> {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return notification;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.findOne(id, userId);

    if (notification.readAt) {
      return notification; // Already read
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return updated;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * Delete a notification
   */
  async remove(id: string, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);

    await prisma.notification.delete({
      where: { id: notification.id },
    });
  }

  /**
   * Delete all notifications for a user
   */
  async removeAll(userId: string): Promise<void> {
    await prisma.notification.deleteMany({
      where: { userId },
    });
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  }
}
