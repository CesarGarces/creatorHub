/**
 * Likes and views of a user's generated assets (images and videos) —
 * `GET /user/assets/engagement`, read by the dashboard's "Likes & views"
 * widget (ARCHITECTURE.md §2f). Likes and views happen on the public share
 * page (`/share/:assetId`); the counts are kept on each asset.
 */

/** Most assets one request may list. */
export const ASSET_ENGAGEMENT_MAX_TOP = 12;
/** Assets listed when the request doesn't say. */
export const ASSET_ENGAGEMENT_DEFAULT_TOP = 4;

export type EngagedAssetType = "IMAGE" | "VIDEO";

export interface EngagedAsset {
  id: string;
  type: EngagedAssetType;
  /** The prompt it was generated from (its only title). */
  title: string;
  /**
   * A still to show: the image itself, or the video's first-frame
   * thumbnail — never the video. Short-lived signed URL; `null` when a
   * video has no thumbnail.
   */
  previewUrl: string | null;
  likeCount: number;
  viewCount: number;
  /** Shared publicly (its page at /share/:id can be opened). */
  isPublic: boolean;
  createdAt: string;
}

export interface AssetEngagement {
  totals: {
    likes: number;
    views: number;
    /** Assets counted (the ones of the current storage). */
    assets: number;
    publicAssets: number;
  };
  /** Assets with at least one like or view: most liked, then most viewed. */
  top: EngagedAsset[];
}
