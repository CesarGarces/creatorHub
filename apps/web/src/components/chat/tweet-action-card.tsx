"use client";

import { useState } from "react";
import { cn } from "@creator-hub/ui";
import api from "@/lib/api";
import { toast } from "sonner";

interface TweetActionCardProps {
  draftId: string;
  content: string;
  topic: string;
  onNavigate?: (path: string) => void;
}

export function TweetActionCard({
  draftId,
  content,
  topic,
  onNavigate,
}: TweetActionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);

  const charCount = editedContent.length;
  const isOverLimit = charCount > 280;

  const handleSave = async () => {
    if (isOverLimit) {
      toast.error("Tweet exceeds 280 characters");
      return;
    }

    setIsSaving(true);
    try {
      await api.patch(`/social/tweets/drafts/${draftId}`, {
        content: editedContent,
      });
      setIsEditing(false);
      toast.success("Tweet updated");
    } catch (error) {
      toast.error("Failed to update tweet");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
      <div className="px-3.5 py-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <TwitterIcon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-text">Tweet Draft</p>
            <p className="text-[10px] text-text-muted">Topic: {topic}</p>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className={cn(
                "w-full rounded-lg border bg-surface px-3 py-2 text-[12px] text-text",
                "focus:outline-none focus:ring-2 focus:ring-primary",
                "resize-none",
                isOverLimit ? "border-error" : "border-border",
              )}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-[10px]",
                  isOverLimit ? "text-error" : "text-text-muted",
                )}
              >
                {charCount}/280
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-text-muted hover:bg-surface-elevated"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  disabled={isSaving || isOverLimit}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-2 rounded-lg bg-surface px-3 py-2">
              <p className="text-[12px] text-text whitespace-pre-wrap">
                {content}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-muted">
                {charCount}/280 characters
              </span>
              <button
                onClick={() => setIsEditing(true)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
