import { Injectable } from "@nestjs/common";
import { prisma, type Prisma } from "@creator-hub/database";
import { StorageService } from "@creator-hub/storage";
import {
  ASSET_ENGAGEMENT_DEFAULT_TOP,
  type AssetEngagement,
  type EngagedAsset,
} from "@creator-hub/shared-types";
import { resolveStorageRef } from "./storage-ref";

/** Signed preview URLs live as long as the assets list's (1 h). */
const PREVIEW_TTL_SECONDS = 3600;

/**
 * Likes and views of the user's assets (ARCHITECTURE.md §2f): totals and
 * the most liked/viewed ones with a still preview — the image, or the
 * video's first-frame thumbnail (`metadata.thumbnailKey`, made by the video
 * worker); a video is never sent to be previewed.
 *
 * Counts come from the counters kept on each asset by the share page
 * (`likeCount`, `viewCount`), over the same assets as the Assets page (the
 * user's, on the current storage).
 */
@Injectable()
export class AssetEngagementService {
  constructor(private readonly storage: StorageService) {}

  async getEngagement(
    userId: string,
    limit = ASSET_ENGAGEMENT_DEFAULT_TOP,
  ): Promise<AssetEngagement> {
    const where: Prisma.GeneratedImageWhereInput = {
      userId,
      storageProvider: this.storage.getProvider(),
    };

    const [sums, publicAssets, rows] = await Promise.all([
      prisma.generatedImage.aggregate({
        where,
        _sum: { likeCount: true, viewCount: true },
        _count: { _all: true },
      }),
      prisma.generatedImage.count({ where: { ...where, isPublic: true } }),
      prisma.generatedImage.findMany({
        where: {
          ...where,
          OR: [{ likeCount: { gt: 0 } }, { viewCount: { gt: 0 } }],
        },
        orderBy: [
          { likeCount: "desc" },
          { viewCount: "desc" },
          { createdAt: "desc" },
        ],
        take: limit,
        select: {
          id: true,
          type: true,
          prompt: true,
          url: true,
          metadata: true,
          likeCount: true,
          viewCount: true,
          isPublic: true,
          createdAt: true,
        },
      }),
    ]);

    const top = await Promise.all(
      rows.map(async (row): Promise<EngagedAsset> => {
        const metadata = row.metadata as { thumbnailKey?: unknown } | null;
        const still =
          row.type === "VIDEO"
            ? typeof metadata?.thumbnailKey === "string"
              ? metadata.thumbnailKey
              : null
            : row.url;
        return {
          id: row.id,
          type: row.type,
          title: row.prompt,
          previewUrl: await resolveStorageRef(
            this.storage,
            still,
            PREVIEW_TTL_SECONDS,
          ),
          likeCount: row.likeCount,
          viewCount: row.viewCount,
          isPublic: row.isPublic,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    );

    return {
      totals: {
        likes: sums._sum.likeCount ?? 0,
        views: sums._sum.viewCount ?? 0,
        assets: sums._count._all,
        publicAssets,
      },
      top,
    };
  }
}
