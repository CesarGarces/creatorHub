import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "@creator-hub/auth";
import { NotificationService } from "./notification.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notifications
   * Get all notifications for the current user
   */
  @Get()
  async findAll(
    @Req() req: { user: { id: string } },
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    const userId = req.user.id;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const parsedUnreadOnly = unreadOnly === "true";

    return this.notificationService.findAllByUser(userId, {
      limit: parsedLimit,
      offset: parsedOffset,
      unreadOnly: parsedUnreadOnly,
    });
  }

  /**
   * GET /notifications/unread-count
   * Get unread count for the current user
   */
  @Get("unread-count")
  async getUnreadCount(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  /**
   * GET /notifications/:id
   * Get a single notification by ID
   */
  @Get(":id")
  async findOne(@Req() req: { user: { id: string } }, @Param("id") id: string) {
    const userId = req.user.id;
    return this.notificationService.findOne(id, userId);
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a notification as read
   */
  @Patch(":id/read")
  async markAsRead(
    @Req() req: { user: { id: string } },
    @Param("id") id: string,
  ) {
    const userId = req.user.id;
    return this.notificationService.markAsRead(id, userId);
  }

  /**
   * PATCH /notifications/read-all
   * Mark all notifications as read
   */
  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    await this.notificationService.markAllAsRead(userId);
  }

  /**
   * DELETE /notifications/:id
   * Delete a notification
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: { user: { id: string } }, @Param("id") id: string) {
    const userId = req.user.id;
    await this.notificationService.remove(id, userId);
  }

  /**
   * DELETE /notifications
   * Delete all notifications for the current user
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAll(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    await this.notificationService.removeAll(userId);
  }
}
