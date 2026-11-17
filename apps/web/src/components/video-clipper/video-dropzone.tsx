"use client";

import { useId, useRef, useState } from "react";
import { ShieldCheck, UploadCloud } from "lucide-react";
import { Button, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { MAX_VIDEO_BYTES } from "@/lib/video-clipper/constants";
import { formatBytes } from "@/lib/video-clipper/format";

export interface VideoDropzoneProps {
  /** Called with the picked or dropped file (validated by the caller). */
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Drag & drop / file picker for the local video. Nothing is uploaded: the
 * page opens the file as an object URL.
 */
export function VideoDropzone({
  onFile,
  disabled = false,
  className,
}: VideoDropzoneProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      data-testid="video-dropzone"
      data-dragging={dragging || undefined}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) pick(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:py-14",
        dragging
          ? "border-primary bg-primary/10"
          : "border-border bg-surface hover:border-primary/50",
        className,
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
        <UploadCloud className="h-7 w-7" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-semibold text-text">
          {dragging
            ? t("videoClipper.upload.dropNow")
            : t("videoClipper.upload.title")}
        </p>
        <p id={hintId} className="mt-1 text-sm text-text-muted">
          {t("videoClipper.upload.subtitle", {
            max: formatBytes(MAX_VIDEO_BYTES),
          })}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.mov,.m4v,.webm,.mkv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files);
          // Picking the same file again must fire onChange again.
          e.target.value = "";
        }}
        data-testid="video-file-input"
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-describedby={hintId}
        className="pointer-coarse:h-11"
      >
        {t("videoClipper.upload.choose")}
      </Button>
      <p className="flex max-w-md items-start gap-1.5 text-xs text-text-dim">
        <ShieldCheck
          className="mt-px h-3.5 w-3.5 shrink-0 text-secondary"
          aria-hidden="true"
        />
        <span>{t("videoClipper.privacy")}</span>
      </p>
    </div>
  );
}
