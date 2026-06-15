"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button, EmptyState } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  provider: string;
  model: string;
  width: number;
  height: number;
  credits: number;
  createdAt: string;
}

export default function AssetsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["images", page],
    queryFn: () => api.get<{ data: GeneratedImage[]; meta: any }>(`/images?page=${page}&limit=12`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/images/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success("Image deleted");
      setSelectedImage(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete image");
    },
  });

  const images = data?.data || [];
  const meta = data?.meta;

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Assets" },
        ]}
      />
      <div className="p-6 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">Assets</h1>
          <p className="mt-1 text-text-muted">Your generated images and files</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-video rounded-xl bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <EmptyState
            icon="📁"
            title="No assets yet"
            description="Generated images and files will appear here."
            actionLabel="Generate your first thumbnail"
            onAction={() => (window.location.href = "/tools/thumbnail-generator")}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group relative rounded-xl overflow-hidden border border-border bg-surface-elevated cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedImage(img)}
                >
                  <div className="aspect-video">
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-text-muted line-clamp-2">{img.prompt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-dim">
                        {new Date(img.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Use prompt"
                          title="Use prompt"
                          onClick={() => {
                            router.push(`/tools/thumbnail-generator?prompt=${encodeURIComponent(img.prompt)}`);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Download"
                          title="Download"
                          onClick={async () => {
                            try {
                              const res = await fetch(img.url);
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `image-${img.id}.png`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch {
                              toast.error("Download failed");
                            }
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" x2="12" y1="15" y2="3" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Copy link"
                          title="Copy link"
                          onClick={() => {
                            navigator.clipboard.writeText(img.url);
                            toast.success("URL copied");
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Delete asset"
                          title="Delete asset"
                          onClick={() => {
                            if (confirm("Delete this image?")) {
                              deleteMutation.mutate(img.id);
                            }
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-error">
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
                  Previous
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
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80" onClick={() => setSelectedImage(null)} />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col bg-surface rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-muted line-clamp-1">{selectedImage.prompt}</p>
                <p className="text-xs text-text-dim mt-1">
                  {selectedImage.width}×{selectedImage.height} · {selectedImage.model} · {new Date(selectedImage.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="ml-4 rounded-lg p-2 text-text-muted hover:text-text hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/50">
              <img
                src={selectedImage.url}
                alt={selectedImage.prompt}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  router.push(`/tools/thumbnail-generator?prompt=${encodeURIComponent(selectedImage.prompt)}`);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                Use Prompt
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch(selectedImage.url);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `image-${selectedImage.id}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    toast.error("Download failed");
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Download
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(selectedImage.url);
                  toast.success("URL copied");
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Copy URL
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-error hover:text-error"
                onClick={() => {
                  if (confirm("Delete this image?")) {
                    deleteMutation.mutate(selectedImage.id);
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
