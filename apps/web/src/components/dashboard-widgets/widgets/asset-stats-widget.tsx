"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Eye, Film, Heart, ImageOff, Play } from "lucide-react";
import type { EngagedAsset } from "@creator-hub/shared-types";
import { Skeleton, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import {
  ASSET_STATS_LIMIT,
  assetLink,
  fetchAssetEngagement,
} from "@/lib/dashboard-widgets/asset-stats";
import { WidgetHeader } from "../widget-header";

/** Same rows as "Plans for today", so both widgets have the same size. */
const row = "flex items-center gap-3 px-4 py-3.5 sm:px-5";

/**
 * "Likes & views": the total likes and views of the user's assets, then the
 * most liked ones as rows — a small still (the image, or a video's
 * thumbnail: videos are never loaded or played here), the title and its
 * own likes and views. A half-width card like "Plans for today". A shared
 * asset opens its public page (where its likes and views come from) in a
 * new tab, so the dashboard stays open.
 */
export function AssetStatsWidget() {
  const { t, formatNumber } = useI18n();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["asset-engagement", ASSET_STATS_LIMIT],
    queryFn: () => fetchAssetEngagement(ASSET_STATS_LIMIT),
  });

  return (
    <section>
      <WidgetHeader
        title={t("dashboard.widgets.assetStats.name")}
        action={
          <Link
            href="/assets"
            className="text-xs text-primary hover:text-primary-hover transition-colors"
          >
            {t("dashboard.assetStats.open")}
          </Link>
        }
      />
      <div className="rounded-xl border border-border bg-surface">
        {isError ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="text-sm text-text-muted">
              {t("dashboard.assetStats.error")}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-xs font-medium text-primary hover:text-primary-hover pointer-coarse:min-h-11"
            >
              {t("dashboard.assetStats.retry")}
            </button>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <Total
                icon={Heart}
                tone="bg-rose-500/10 text-rose-400"
                label={t("dashboard.assetStats.totalLikes")}
                value={data ? formatNumber(data.totals.likes) : null}
              />
              <Total
                icon={Eye}
                tone="bg-sky-500/10 text-sky-400"
                label={t("dashboard.assetStats.totalViews")}
                value={data ? formatNumber(data.totals.views) : null}
              />
            </dl>

            {isPending ? (
              <div aria-hidden="true" className="divide-y divide-border">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className={row}>
                    <Skeleton className="h-9 w-16 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : data.top.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
                <p className="max-w-xs text-sm text-text-dim">
                  {t("dashboard.assetStats.empty")}
                </p>
                <Link
                  href="/assets"
                  className="inline-flex items-center text-xs font-medium text-primary underline underline-offset-4 hover:text-primary-hover pointer-coarse:min-h-11"
                >
                  {t("dashboard.assetStats.goToAssets")}
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.top.map((asset) => (
                  <li key={asset.id} data-asset-id={asset.id}>
                    <AssetRow asset={asset} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Total({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof Heart;
  tone: string;
  label: string;
  /** `null` while loading. */
  value: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className="truncate text-xs text-text-muted">{label}</dt>
        <dd className="text-lg font-bold leading-tight tabular-nums text-text">
          {value ?? <Skeleton className="mt-0.5 h-5 w-12" />}
        </dd>
      </div>
    </div>
  );
}

function AssetRow({ asset }: { asset: EngagedAsset }) {
  const { t, formatNumber } = useI18n();
  // An expired/broken preview shows the placeholder, not a broken image.
  const [failed, setFailed] = useState(false);
  const compact = (n: number) =>
    formatNumber(n, { notation: "compact", maximumFractionDigits: 1 });
  const isVideo = asset.type === "VIDEO";
  const preview = !failed ? asset.previewUrl : null;
  const link = assetLink(asset);

  return (
    <Link
      href={link.href}
      {...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        row,
        "group transition-colors hover:bg-surface-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
      )}
    >
      {/* A small 16:9 still: the image, or a video's thumbnail. */}
      <span className="relative h-9 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-bg">
        {preview ? (
          // alt is empty: the title is the link's text right beside it.
          // A plain <img>: signed storage URLs, as on the Assets page.
          <img
            src={preview}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            draggable={false}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            data-preview="none"
            title={t("dashboard.assetStats.noPreview")}
            className="flex h-full w-full items-center justify-center text-text-dim"
          >
            {isVideo ? (
              <>
                <Film className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">
                  {t("dashboard.assetStats.video")}
                </span>
              </>
            ) : (
              <ImageOff className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        )}
        {isVideo && preview && (
          // Marks a video thumbnail (nothing plays here); without one, the
          // film placeholder already says "video".
          <span className="absolute bottom-0.5 left-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-white">
            <Play className="h-2 w-2 fill-current" aria-hidden="true" />
            <span className="sr-only">{t("dashboard.assetStats.video")}</span>
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium text-text">
          <span className="truncate">
            {asset.title || t("dashboard.assetStats.untitled")}
          </span>
          {link.newTab && (
            <>
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 text-text-dim transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
              <span className="sr-only">
                {t("dashboard.assetStats.newTab")}
              </span>
            </>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-3 text-xs tabular-nums text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3 text-rose-400" aria-hidden="true" />
            <span aria-hidden="true">{compact(asset.likeCount)}</span>
            <span className="sr-only">
              {t("dashboard.assetStats.likes", { count: asset.likeCount })}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3 text-sky-400" aria-hidden="true" />
            <span aria-hidden="true">{compact(asset.viewCount)}</span>
            <span className="sr-only">
              {t("dashboard.assetStats.views", { count: asset.viewCount })}
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
