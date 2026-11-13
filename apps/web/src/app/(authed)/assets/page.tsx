"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Share2, Globe, Lock } from "lucide-react";
import api from "@/lib/api";
import { Button, EmptyState, ActionConfirmDialog } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { AssetLikeButton } from "@/components/asset-like-button";
import { ShareModal } from "@/components/share-modal";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";

interface GeneratedAsset {
  id: string;
  url: string;
  prompt: string;
  provider: string;
  model: string;
  type: "IMAGE" | "VIDEO";
  width: number;
  height: number;
  credits: number;
  isPublic: boolean;
  likeCount: number;
  createdAt: string;
}

type AssetFilter = "all" | "IMAGE" | "VIDEO";

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://app.creatorhubplatform.com";

export default function AssetsPage() {
  const router = useRouter();
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [selectedAsset, setSelectedAsset] = useState<GeneratedAsset | null>(
    null,
  );
  const [shareModalAsset, setShareModalAsset] = useState<GeneratedAsset | null>(
    null,
  );
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    assetId: string | null;
  }>({
    isOpen: false,
    assetId: null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["images", page, assetFilter],
    queryFn: () => {
      const typeParam = assetFilter !== "all" ? `&type=${assetFilter}` : "";
      return api.get<{ data: GeneratedAsset[]; meta: any }>(
        `/images?page=${page}&limit=8${typeParam}`,
      );
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/images/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success(t("assets.toasts.deleted"));
      setSelectedAsset(null);
    },
    onError: (error: unknown) => {
      toast.error(localizeError(error, "assets.toasts.deleteFailed"));
    },
  });

  const togglePublicMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<{ isPublic: boolean }>(`/images/${id}/public`),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      // Update selected asset if it's the one being toggled
      if (selectedAsset?.id === variables) {
        setSelectedAsset((prev) =>
          prev ? { ...prev, isPublic: data.isPublic } : null,
        );
      }
      toast.success(
        data.isPublic
          ? t("assets.toasts.nowPublic")
          : t("assets.toasts.nowPrivate"),
      );
    },
    onError: (error: unknown) => {
      toast.error(localizeError(error, "assets.toasts.visibilityFailed"));
    },
  });

  const assets = data?.data || [];
  const meta = data?.meta;

  const handleDelete = () => {
    if (!deleteDialog.assetId) return;
    deleteMutation.mutate(deleteDialog.assetId);
    setDeleteDialog({ isOpen: false, assetId: null });
  };

  const handleFilterChange = (filter: AssetFilter) => {
    setAssetFilter(filter);
    setPage(1);
  };

  const handleCopyShareLink = async (asset: GeneratedAsset) => {
    const url = `${FRONTEND_URL}/share/${asset.id}`;
    await navigator.clipboard.writeText(url);
    toast.success(t("assets.toasts.linkCopied"));
  };

  const handleTogglePublic = (assetId: string) => {
    togglePublicMutation.mutate(assetId);
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.assets") },
        ]}
      />
      <div className="p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">{t("assets.title")}</h1>
          <p className="mt-1 text-text-muted">{t("assets.subtitle")}</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { id: "all" as AssetFilter, label: t("assets.filters.all") },
            { id: "IMAGE" as AssetFilter, label: t("assets.filters.images") },
            { id: "VIDEO" as AssetFilter, label: t("assets.filters.videos") },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                assetFilter === tab.id
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "bg-surface-elevated text-text-muted hover:text-text border border-border hover:border-border/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-video rounded-xl bg-surface-elevated animate-pulse"
              />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <EmptyState
            icon="📁"
            title={t("assets.emptyTitle")}
            description={
              assetFilter === "all"
                ? t("assets.emptyAll")
                : assetFilter === "IMAGE"
                  ? t("assets.emptyImages")
                  : t("assets.emptyVideos")
            }
            actionLabel={
              assetFilter === "VIDEO"
                ? t("assets.firstVideo")
                : t("assets.firstThumbnail")
            }
            onAction={() =>
              router.push(
                assetFilter === "VIDEO"
                  ? "/tools/video-generator"
                  : "/tools/thumbnail-generator",
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-xl overflow-hidden border border-border bg-surface-elevated cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div className="aspect-video relative">
                    {asset.type === "VIDEO" ? (
                      <>
                        <video
                          src={asset.url}
                          className="w-full h-full object-cover"
                          muted
                          aria-label={t("assets.videoPreview", {
                            title: asset.prompt || t("assets.untitled"),
                          })}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="black"
                            >
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </div>
                        </div>
                      </>
                    ) : (
                      <img
                        src={asset.url}
                        alt={asset.prompt}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {/* Public indicator */}
                    {asset.isPublic && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/90 text-white text-[10px] font-medium rounded-full flex items-center gap-1">
                        <Globe size={10} />
                        {t("assets.public")}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          asset.type === "VIDEO"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {asset.type === "VIDEO"
                          ? t("assets.type.video")
                          : t("assets.type.image")}
                      </span>
                      <p className="text-xs text-text-muted line-clamp-1 flex-1">
                        {asset.prompt}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-dim">
                        {formatDate(asset.createdAt, { dateStyle: "short" })}
                      </span>
                      <div
                        className="flex gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("assets.usePrompt")}
                          title={t("assets.usePrompt")}
                          onClick={() => {
                            router.push(
                              `/tools/${asset.type === "VIDEO" ? "video-generator" : "thumbnail-generator"}?prompt=${encodeURIComponent(asset.prompt)}`,
                            );
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("assets.download")}
                          title={t("assets.download")}
                          onClick={async () => {
                            try {
                              const res = await fetch(asset.url);
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${asset.type === "VIDEO" ? "video" : "image"}-${asset.id}.${asset.type === "VIDEO" ? "mp4" : "png"}`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch {
                              toast.error(t("common.toasts.downloadFailed"));
                            }
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" x2="12" y1="15" y2="3" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("assets.share")}
                          title={t("assets.share")}
                          onClick={() => setShareModalAsset(asset)}
                        >
                          <Share2 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("assets.deleteAsset")}
                          title={t("assets.deleteAsset")}
                          onClick={() =>
                            setDeleteDialog({
                              isOpen: true,
                              assetId: asset.id,
                            })
                          }
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-error"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("assets.previous")}
                </Button>
                <span className="flex items-center px-3 text-sm text-text-muted">
                  {page} / {meta.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("assets.next")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Asset Preview Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setSelectedAsset(null)}
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col bg-surface rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      selectedAsset.type === "VIDEO"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {selectedAsset.type === "VIDEO"
                      ? t("assets.type.video")
                      : t("assets.type.image")}
                  </span>
                  <p className="text-sm text-text-muted line-clamp-1">
                    {selectedAsset.prompt}
                  </p>
                </div>
                <p className="text-xs text-text-dim mt-1">
                  {selectedAsset.width}×{selectedAsset.height} ·{" "}
                  {selectedAsset.model} ·{" "}
                  {formatDate(selectedAsset.createdAt, { dateStyle: "short" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                aria-label={t("assets.closePreview")}
                className="ml-4 rounded-lg p-2 text-text-muted hover:text-text hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/50">
              {selectedAsset.type === "VIDEO" ? (
                <video
                  src={selectedAsset.url}
                  controls
                  className="max-w-full max-h-[70vh] rounded-lg"
                  aria-label={t("assets.videoPlayer", {
                    title: selectedAsset.prompt || t("assets.untitled"),
                  })}
                />
              ) : (
                <img
                  src={selectedAsset.url}
                  alt={selectedAsset.prompt}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-border">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    router.push(
                      `/tools/${selectedAsset.type === "VIDEO" ? "video-generator" : "thumbnail-generator"}?prompt=${encodeURIComponent(selectedAsset.prompt)}`,
                    );
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  {t("assets.usePromptButton")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch(selectedAsset.url);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${selectedAsset.type === "VIDEO" ? "video" : "image"}-${selectedAsset.id}.${selectedAsset.type === "VIDEO" ? "mp4" : "png"}`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      toast.error(t("common.toasts.downloadFailed"));
                    }
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  {t("assets.download")}
                </Button>
                <AssetLikeButton
                  assetId={selectedAsset.id}
                  initialLikeCount={selectedAsset.likeCount || 0}
                  isPublic={selectedAsset.isPublic}
                  size="sm"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShareModalAsset(selectedAsset)}
                >
                  <Share2 size={14} />
                  {t("assets.share")}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {/* Make Public Toggle */}
                <button
                  type="button"
                  onClick={() => handleTogglePublic(selectedAsset.id)}
                  disabled={togglePublicMutation.isPending}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedAsset.isPublic
                      ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                      : "bg-surface-elevated text-text-muted hover:bg-surface-elevated/80"
                  }`}
                >
                  {selectedAsset.isPublic ? (
                    <Globe size={14} />
                  ) : (
                    <Lock size={14} />
                  )}
                  {selectedAsset.isPublic
                    ? t("assets.public")
                    : t("assets.private")}
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-error hover:text-error"
                  onClick={() =>
                    setDeleteDialog({
                      isOpen: true,
                      assetId: selectedAsset.id,
                    })
                  }
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                  {t("assets.delete")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, assetId: null })}
        onConfirm={handleDelete}
        title={t("assets.deleteDialog.title")}
        description={t("assets.deleteDialog.description")}
        confirmLabel={t("assets.deleteDialog.confirm")}
        cancelLabel={t("assets.deleteDialog.cancel")}
        confirmVariant="danger"
        icon={<Trash2 className="h-5 w-5" />}
        isLoading={deleteMutation.isPending}
      />

      {/* Share Modal */}
      {shareModalAsset && (
        <ShareModal
          assetId={shareModalAsset.id}
          assetPrompt={shareModalAsset.prompt}
          assetType={shareModalAsset.type}
          isPublic={shareModalAsset.isPublic}
          onTogglePublic={() => {
            handleTogglePublic(shareModalAsset.id);
            setShareModalAsset((prev) =>
              prev ? { ...prev, isPublic: !prev.isPublic } : null,
            );
          }}
          onClose={() => setShareModalAsset(null)}
        />
      )}
    </>
  );
}
