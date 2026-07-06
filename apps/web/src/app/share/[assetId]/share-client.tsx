"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { AssetLikeButton } from "@/components/asset-like-button";
import { ShareModal } from "@/components/share-modal";

export interface PublicAsset {
  id: string;
  prompt: string;
  type: "IMAGE" | "VIDEO";
  width: number;
  height: number;
  model: string;
  provider: string;
  url: string;
  likeCount: number;
  viewCount: number;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface ShareClientProps {
  asset: PublicAsset;
  assetId: string;
}

export function ShareClient({ asset, assetId }: ShareClientProps) {
  const router = useRouter();
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegister = () => {
    router.push(`/register?ref=public_asset_${assetId}`);
  };

  const handleLogin = () => {
    router.push(`/login?ref=public_asset_${assetId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img
              src="/isologo_white.png"
              alt="Creator Hub"
              className="h-8 w-auto"
            />
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogin}
              className="px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleRegister}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Asset Display */}
        <div className="bg-surface rounded-2xl overflow-hidden border border-border shadow-lg">
          {/* Image/Video */}
          <div className="relative bg-black/50 flex items-center justify-center min-h-[300px] md:min-h-[500px]">
            {asset.type === "VIDEO" ? (
              <video
                src={asset.url}
                controls
                className="max-w-full max-h-[70vh] rounded-lg"
                poster={asset.url.replace(/\.[^/.]+$/, ".jpg")}
              />
            ) : (
              <img
                src={asset.url}
                alt={asset.prompt}
                className="max-w-full max-h-[70vh] object-contain"
                loading="eager"
              />
            )}
          </div>

          {/* Asset Info */}
          <div className="p-6">
            {/* Creator Info */}
            <div className="flex items-center gap-3 mb-4">
              {asset.creator.avatarUrl ? (
                <img
                  src={asset.creator.avatarUrl}
                  alt={asset.creator.name || "Creator"}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="text-primary font-medium">
                    {asset.creator.name?.charAt(0)?.toUpperCase() ?? "C"}
                  </span>
                </div>
              )}
              <div>
                <p className="text-text font-medium">
                  {asset.creator.name || "Anonymous Creator"}
                </p>
                <p className="text-text-muted text-sm">
                  Created{" "}
                  {new Date(asset.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Prompt */}
            <div className="mb-6">
              <p className="text-text text-lg leading-relaxed">
                &ldquo;{asset.prompt}&rdquo;
              </p>
            </div>

            {/* Asset Details */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  asset.type === "VIDEO"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {asset.type === "VIDEO" ? "Video" : "Image"}
              </span>
              <span className="rounded-full px-3 py-1 text-xs font-medium bg-surface-elevated text-text-muted">
                {asset.width}x{asset.height}
              </span>
              <span className="rounded-full px-3 py-1 text-xs font-medium bg-surface-elevated text-text-muted">
                {asset.model}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <AssetLikeButton
                assetId={asset.id}
                initialLikeCount={asset.likeCount}
                size="lg"
              />

              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-surface-elevated text-text rounded-xl hover:bg-surface-elevated/80 transition-colors"
              >
                <Share2 size={18} />
                <span>Share</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-4 py-2 bg-surface-elevated text-text rounded-xl hover:bg-surface-elevated/80 transition-colors"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-6 pt-6 border-t border-border text-sm text-text-muted">
              <div className="flex items-center gap-1">
                <Heart size={14} />
                <span>{asset.likeCount} likes</span>
              </div>
              <div className="flex items-center gap-1">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{asset.viewCount} views</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="mt-8 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-8 border border-primary/20">
          <div className="text-center max-w-2xl mx-auto">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-text mb-3">
              Create Something Amazing
            </h2>
            <p className="text-text-muted mb-6 text-lg">
              This stunning {asset.type === "VIDEO" ? "video" : "image"} was
              created by{" "}
              <span className="text-text font-medium">
                {asset.creator.name || "a Creator Hub user"}
              </span>{" "}
              using our AI-powered tools. What will you create?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleRegister}
                className="px-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                Start Creating Free
              </button>
              <button
                onClick={handleLogin}
                className="px-8 py-4 bg-transparent border border-border text-text-muted rounded-xl font-semibold text-lg hover:bg-surface transition-colors"
              >
                Sign In
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 text-text-muted mt-4">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>100 free credits included</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-text-muted text-sm">
          <p>
            Powered by{" "}
            <span className="text-primary font-medium">Creator Hub</span> —
            AI-powered tools for content creators
          </p>
        </div>
      </footer>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          assetId={asset.id}
          assetPrompt={asset.prompt}
          assetType={asset.type}
          isPublic={true}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
