import {
  ASSET_ENGAGEMENT_DEFAULT_TOP,
  type AssetEngagement,
  type EngagedAsset,
} from "@creator-hub/shared-types";
import api from "@/lib/api";

/**
 * "Likes & views" widget: the likes and views of the user's assets
 * (`GET /user/assets/engagement`, ARCHITECTURE.md §2f).
 */
export const ASSET_ENGAGEMENT_ENDPOINT = "/user/assets/engagement";

/** Assets shown as previews in the widget. */
export const ASSET_STATS_LIMIT = ASSET_ENGAGEMENT_DEFAULT_TOP;

const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;

function toAsset(value: unknown): EngagedAsset | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  if (typeof a.id !== "string" || !a.id) return null;
  return {
    id: a.id,
    type: a.type === "VIDEO" ? "VIDEO" : "IMAGE",
    title: typeof a.title === "string" ? a.title : "",
    previewUrl:
      typeof a.previewUrl === "string" && a.previewUrl ? a.previewUrl : null,
    likeCount: count(a.likeCount),
    viewCount: count(a.viewCount),
    isPublic: a.isPublic === true,
    createdAt: typeof a.createdAt === "string" ? a.createdAt : "",
  };
}

/** Any body (an older API, a mock) as a usable result: zeros, no assets. */
export function normalizeAssetEngagement(value: unknown): AssetEngagement {
  const body = (value && typeof value === "object" ? value : {}) as {
    totals?: Record<string, unknown>;
    top?: unknown;
  };
  const totals = body.totals ?? {};
  return {
    totals: {
      likes: count(totals.likes),
      views: count(totals.views),
      assets: count(totals.assets),
      publicAssets: count(totals.publicAssets),
    },
    top: Array.isArray(body.top)
      ? body.top.map(toAsset).filter((a): a is EngagedAsset => a !== null)
      : [],
  };
}

export async function fetchAssetEngagement(
  limit = ASSET_STATS_LIMIT,
): Promise<AssetEngagement> {
  const body = await api.get<unknown>(ASSET_ENGAGEMENT_ENDPOINT, {
    params: { limit: String(limit) },
  });
  return normalizeAssetEngagement(body);
}

export interface AssetLink {
  href: string;
  /** Opens in a new tab, so the dashboard stays open. */
  newTab: boolean;
}

/**
 * Where an asset opens: a shared one, its public page (where its likes and
 * views come from) in a new tab; a private one, the Assets page (no public
 * page to show) in the same tab.
 */
export function assetLink(
  asset: Pick<EngagedAsset, "id" | "isPublic">,
): AssetLink {
  return asset.isPublic
    ? { href: `/share/${encodeURIComponent(asset.id)}`, newTab: true }
    : { href: "/assets", newTab: false };
}
