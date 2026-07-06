"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Share2, Globe, Lock } from "lucide-react";
import { toast } from "sonner";

interface ShareModalProps {
  assetId: string;
  assetPrompt: string;
  assetType: "IMAGE" | "VIDEO";
  isPublic: boolean;
  onTogglePublic?: () => void;
  onClose: () => void;
}

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL || "https://app.creatorhubplatform.com";

export function ShareModal({
  assetId,
  assetPrompt,
  assetType,
  isPublic,
  onTogglePublic,
  onClose,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    setShareUrl(`${FRONTEND_URL}/share/${assetId}`);
  }, [assetId]);

  const handleCopyLink = async () => {
    if (!isPublic) {
      toast.error("Make the asset public first to share it");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (!isPublic) {
      toast.error("Make the asset public first to share it");
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Created with Creator Hub`,
          text: `Check out this ${assetType.toLowerCase()} I found on Creator Hub: "${assetPrompt}"`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  const getShareUrl = (platform: string) => {
    const text = encodeURIComponent(
      `Check out this ${assetType.toLowerCase()} I found on Creator Hub: "${assetPrompt}"`,
    );
    const url = encodeURIComponent(shareUrl);

    switch (platform) {
      case "facebook":
        return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      case "twitter":
        return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
      case "linkedin":
        return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
      case "whatsapp":
        return `https://wa.me/?text=${text}%20${url}`;
      case "telegram":
        return `https://t.me/share/url?url=${url}&text=${text}`;
      case "reddit":
        return `https://reddit.com/submit?url=${url}&title=${text}`;
      case "pinterest":
        return `https://pinterest.com/pin/create/button/?url=${url}&description=${text}`;
      default:
        return "#";
    }
  };

  const handleShare = (platform: string) => {
    if (!isPublic) {
      toast.error("Make the asset public first to share it");
      return;
    }
    const url = getShareUrl(platform);
    if (url !== "#") {
      window.open(url, "_blank", "width=600,height=400");
    }
  };

  const socialPlatforms = [
    {
      id: "facebook",
      name: "Facebook",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      color: "hover:bg-blue-600/10 hover:text-blue-600",
    },
    {
      id: "twitter",
      name: "X (Twitter)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      color:
        "hover:bg-black/10 hover:text-black dark:hover:bg-white/10 dark:hover:text-white",
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      color: "hover:bg-blue-700/10 hover:text-blue-700",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      color: "hover:bg-green-600/10 hover:text-green-600",
    },
    {
      id: "telegram",
      name: "Telegram",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
      color: "hover:bg-blue-500/10 hover:text-blue-500",
    },
    {
      id: "reddit",
      name: "Reddit",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      ),
      color: "hover:bg-orange-600/10 hover:text-orange-600",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-primary" />
            <h3 className="font-semibold text-text">Share Asset</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Not public warning */}
          {!isPublic && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <Lock size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-500 font-medium">
                  This asset is private
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Make it public to enable sharing and get a link anyone can
                  view.
                </p>
                {onTogglePublic && (
                  <button
                    onClick={onTogglePublic}
                    className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Make public now
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Copy Link */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleCopyLink}
                disabled={!isPublic}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  isPublic
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-surface-elevated text-text-muted cursor-not-allowed opacity-50"
                }`}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div>
            <label className="block text-sm font-medium text-text mb-3">
              Share on Social Media
            </label>
            <div className="grid grid-cols-3 gap-2">
              {socialPlatforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handleShare(platform.id)}
                  disabled={!isPublic}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    isPublic
                      ? `border-border text-text-muted ${platform.color}`
                      : "border-border/50 text-text-muted/40 cursor-not-allowed opacity-50"
                  }`}
                >
                  {platform.icon}
                  <span className="text-xs">{platform.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Native Share (Mobile) */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={handleNativeShare}
              disabled={!isPublic}
              className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                isPublic
                  ? "bg-surface-elevated text-text hover:bg-surface-elevated/80"
                  : "bg-surface-elevated/50 text-text-muted/40 cursor-not-allowed"
              }`}
            >
              <Share2 size={18} />
              Share via Device
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-elevated/50">
          <p className="text-xs text-text-muted text-center">
            {isPublic
              ? "Anyone with this link can view this asset and give it a like"
              : "Only you can see this asset until you make it public"}
          </p>
        </div>
      </div>
    </div>
  );
}
