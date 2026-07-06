import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { StorageService } from "@creator-hub/storage";
import { createHash } from "crypto";

@Injectable()
export class SharingService {
  constructor(private storageService: StorageService) {}

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
   * Get public asset data for sharing
   * Re-signs the R2 URL on demand
   */
  async getPublicAsset(assetId: string) {
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

    // Increment view count (fire and forget)
    prisma.generatedImage
      .update({
        where: { id: assetId },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    return {
      id: asset.id,
      prompt: asset.prompt,
      type: asset.type,
      width: asset.width,
      height: asset.height,
      model: asset.model,
      provider: asset.provider,
      url,
      likeCount: asset.likeCount,
      viewCount: asset.viewCount + 1, // Optimistic increment
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
      select: { id: true, isPublic: true, likeCount: true },
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
}
