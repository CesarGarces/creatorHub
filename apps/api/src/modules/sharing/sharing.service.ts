import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { prisma, NotificationType } from "@creator-hub/database";
import { StorageService } from "@creator-hub/storage";
import { createHash } from "crypto";
import { NotificationService } from "../notification/notification.service";
import { AppGateway } from "../websocket/websocket.gateway";

/**
 * Simple in-memory cache for view tracking.
 * Key: "assetId:fingerprint", Value: timestamp of last view
 * TTL: 24 hours per IP per asset
 */
const VIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const viewCache = new Map<string, number>();

// Cleanup old entries every hour to prevent memory leaks
setInterval(
  () => {
    const now = Date.now();
    for (const [key, timestamp] of viewCache.entries()) {
      if (now - timestamp > VIEW_CACHE_TTL_MS) {
        viewCache.delete(key);
      }
    }
  },
  60 * 60 * 1000,
);

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);

  constructor(
    private storageService: StorageService,
    private notificationService: NotificationService,
    private gateway: AppGateway,
  ) {}

  /**
   * Generate a fingerprint from IP + User-Agent + Accept-Language
   * Used to prevent duplicate likes from the same "session"
   */
  private generateFingerprint(
    ip: string,
    userAgent: string,
    acceptLanguage: string,
  ): string {
    const raw = `${ip}|${userAgent}|${acceptLanguage}`;
    return createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Check if this IP has viewed this asset in the last 24 hours
   */
  private hasViewedRecently(assetId: string, fingerprint: string): boolean {
    const key = `${assetId}:${fingerprint}`;
    const lastView = viewCache.get(key);
    if (!lastView) return false;
    return Date.now() - lastView < VIEW_CACHE_TTL_MS;
  }

  /**
   * Mark this IP as having viewed this asset
   */
  private markViewed(assetId: string, fingerprint: string): void {
    const key = `${assetId}:${fingerprint}`;
    viewCache.set(key, Date.now());
  }

  /**
   * Get public asset data for sharing
   * Re-signs the R2 URL on demand
   */
  async getPublicAsset(
    assetId: string,
    ip?: string,
    userAgent?: string,
    acceptLanguage?: string,
  ) {
    const asset = await prisma.generatedImage.findUnique({
      where: { id: assetId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    if (!asset.isPublic) {
      throw new ForbiddenException("This asset is not public");
    }

    // Re-sign the R2 URL
    let url = asset.url || "";
    if (asset.url && !asset.url.startsWith("http")) {
      const parts = asset.url.split("/");
      const bucket = parts[0] || "";
      const key = parts.slice(1).join("/");
      if (bucket && key) {
        try {
          url = await this.storageService.getPresignedDownloadUrl(
            bucket,
            key,
            7 * 24 * 60 * 60, // 7 days
          );
        } catch {
          // If re-signing fails, try using the stored URL
          url = asset.url;
        }
      }
    }

    // Re-sign thumbnail URL for videos (used for og:image and video poster)
    let thumbnailUrl: string | null = null;
    const metadata = asset.metadata as Record<string, unknown> | null;
    const thumbnailKey = metadata?.thumbnailKey as string | undefined;
    if (thumbnailKey && !thumbnailKey.startsWith("http")) {
      const parts = thumbnailKey.split("/");
      const bucket = parts[0] || "";
      const key = parts.slice(1).join("/");
      if (bucket && key) {
        try {
          thumbnailUrl = await this.storageService.getPresignedDownloadUrl(
            bucket,
            key,
            7 * 24 * 60 * 60, // 7 days
          );
        } catch {
          // Thumbnail URL generation failed — non-critical
          this.logger.warn("Failed to generate thumbnail URL", {
            assetId,
            thumbnailKey,
          });
        }
      }
    }

    // Track view: only increment if this IP hasn't viewed in last 24h
    let viewIncremented = false;
    if (ip && userAgent && acceptLanguage) {
      const fingerprint = this.generateFingerprint(
        ip,
        userAgent,
        acceptLanguage,
      );
      if (!this.hasViewedRecently(assetId, fingerprint)) {
        this.markViewed(assetId, fingerprint);
        // Increment view count (fire and forget)
        prisma.generatedImage
          .update({
            where: { id: assetId },
            data: { viewCount: { increment: 1 } },
          })
          .catch(() => {});
        viewIncremented = true;
      }
    }

    return {
      id: asset.id,
      prompt: asset.prompt,
      type: asset.type,
      width: asset.width,
      height: asset.height,
      model: asset.model,
      provider: asset.provider,
      url,
      thumbnailUrl,
      likeCount: asset.likeCount,
      viewCount: asset.viewCount + (viewIncremented ? 1 : 0),
      createdAt: asset.createdAt,
      creator: asset.user,
    };
  }

  /**
   * Toggle like on an asset
   * Uses fingerprinting for anonymous users, userId for registered users
   */
  async toggleLike(
    assetId: string,
    ip: string,
    userAgent: string,
    acceptLanguage: string,
    userId?: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    // Verify asset exists and is public
    const asset = await prisma.generatedImage.findUnique({
      where: { id: assetId },
      select: { id: true, isPublic: true, likeCount: true, userId: true },
    });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    if (!asset.isPublic) {
      throw new ForbiddenException("This asset is not public");
    }

    const fingerprint = this.generateFingerprint(ip, userAgent, acceptLanguage);

    // Check if like already exists
    const existingLike = await prisma.assetLike.findUnique({
      where: {
        assetId_fingerprint: { assetId, fingerprint },
      },
    });

    if (existingLike) {
      // Unlike: remove the like
      await prisma.assetLike.delete({
        where: { id: existingLike.id },
      });

      // Decrement like count
      const updated = await prisma.generatedImage.update({
        where: { id: assetId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });

      return {
        liked: false,
        likeCount: Math.max(0, updated.likeCount),
      };
    } else {
      // Like: create the like
      await prisma.assetLike.create({
        data: {
          assetId,
          fingerprint,
          userId: userId || null,
        },
      });

      // Increment like count
      const updated = await prisma.generatedImage.update({
        where: { id: assetId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });

      // Create notification for asset owner (fire and forget)
      this.createLikeNotification(asset.userId, assetId, userId).catch(
        (error) => {
          this.logger.error("Failed to create like notification", {
            assetId,
            ownerId: asset.userId,
            error: error.message,
          });
        },
      );

      return {
        liked: true,
        likeCount: updated.likeCount,
      };
    }
  }

  /**
   * Check if a user/IP has already liked an asset
   */
  async hasLiked(
    assetId: string,
    ip: string,
    userAgent: string,
    acceptLanguage: string,
    userId?: string,
  ): Promise<boolean> {
    const fingerprint = this.generateFingerprint(ip, userAgent, acceptLanguage);

    const existingLike = await prisma.assetLike.findUnique({
      where: {
        assetId_fingerprint: { assetId, fingerprint },
      },
    });

    return !!existingLike;
  }

  /**
   * Get like count for an asset
   */
  async getLikeCount(assetId: string): Promise<number> {
    const asset = await prisma.generatedImage.findUnique({
      where: { id: assetId },
      select: { likeCount: true },
    });

    return asset?.likeCount ?? 0;
  }

  /**
   * Get share URL for an asset
   */
  getShareUrl(assetId: string): string {
    const baseUrl =
      process.env.FRONTEND_URL || "https://app.creatorhubplatform.com";
    return `${baseUrl}/share/${assetId}`;
  }

  /**
   * Create a notification for the asset owner when someone likes their asset
   */
  private async createLikeNotification(
    ownerId: string,
    assetId: string,
    likerUserId?: string,
  ): Promise<void> {
    // Don't notify if the owner liked their own asset
    if (likerUserId && likerUserId === ownerId) {
      return;
    }

    let title: string;
    let body: string;
    let data: Record<string, unknown> = { assetId };

    if (likerUserId) {
      // Liker is a platform user - get their name
      const liker = await prisma.user.findUnique({
        where: { id: likerUserId },
        select: { id: true, name: true, email: true },
      });

      const likerName = liker?.name || liker?.email || "User";
      title = "New Like";
      body = `${likerName} liked your asset`;
      data = { ...data, likerUserId, likerName };
    } else {
      // Anonymous like
      title = "New Like";
      body = "Someone liked your asset";
    }

    // Create notification in database
    const notification = await this.notificationService.create({
      userId: ownerId,
      type: NotificationType.ASSET_LIKE,
      title,
      body,
      data,
    });

    // Send real-time notification via WebSocket
    this.gateway.emitToUser(ownerId, "notification:new", notification);
  }
}
