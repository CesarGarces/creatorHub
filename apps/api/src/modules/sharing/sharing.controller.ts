import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { SharingService } from "./sharing.service";
import { Public } from "@creator-hub/auth";
import { JwtAuthGuard } from "@creator-hub/auth";
import { ThrottlerGuard } from "@nestjs/throttler";

@Controller("sharing")
export class SharingController {
  constructor(private sharingService: SharingService) {}

  /**
   * GET /sharing/:assetId
   * Public endpoint to view a shared asset
   * Rate limited: 30 requests per minute per IP (global default)
   */
  @Public()
  @Get(":assetId")
  @UseGuards(ThrottlerGuard)
  async getPublicAsset(@Param("assetId") assetId: string, @Req() req: Request) {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const acceptLanguage = req.headers["accept-language"] || "unknown";

    return this.sharingService.getPublicAsset(
      assetId,
      ip,
      userAgent,
      acceptLanguage,
    );
  }

  /**
   * POST /sharing/:assetId/like
   * Toggle like on an asset
   * Rate limited: 10 requests per minute per IP
   * No authentication required (fingerprint-based)
   */
  @Public()
  @Post(":assetId/like")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  async toggleLike(@Param("assetId") assetId: string, @Req() req: Request) {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const acceptLanguage = req.headers["accept-language"] || "unknown";

    // Try to get userId from JWT if present (optional auth)
    let userId: string | undefined;
    try {
      // The JwtAuthGuard would have set req.user if token was provided
      const user = (req as any).user;
      if (user?.id) {
        userId = user.id;
      }
    } catch {
      // Ignore auth errors - this is a public endpoint
    }

    return this.sharingService.toggleLike(
      assetId,
      ip,
      userAgent,
      acceptLanguage,
      userId,
    );
  }

  /**
   * GET /sharing/:assetId/liked
   * Check if the current user/IP has liked this asset
   */
  @Public()
  @Get(":assetId/liked")
  @UseGuards(ThrottlerGuard)
  async hasLiked(@Param("assetId") assetId: string, @Req() req: Request) {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const acceptLanguage = req.headers["accept-language"] || "unknown";

    let userId: string | undefined;
    try {
      const user = (req as any).user;
      if (user?.id) {
        userId = user.id;
      }
    } catch {
      // Ignore
    }

    const liked = await this.sharingService.hasLiked(
      assetId,
      ip,
      userAgent,
      acceptLanguage,
      userId,
    );

    const likeCount = await this.sharingService.getLikeCount(assetId);

    return { liked, likeCount };
  }

  /**
   * GET /sharing/:assetId/share-url
   * Get the share URL for an asset
   */
  @Public()
  @Get(":assetId/share-url")
  @UseGuards(ThrottlerGuard)
  async getShareUrl(@Param("assetId") assetId: string) {
    return { url: this.sharingService.getShareUrl(assetId) };
  }
}
