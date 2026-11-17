"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractKeyframes,
  isAbortError,
  planKeyframeTimestamps,
} from "@/lib/video-clipper/keyframes";
import {
  checkVideoFile,
  readVideoMetadata,
} from "@/lib/video-clipper/video-file";
import type { Keyframe, LocalVideoInfo } from "@/lib/video-clipper/types";

export type LocalVideoStatus =
  | "idle"
  | "reading"
  | "sampling"
  | "ready"
  | "error";

export type LocalVideoError = "type" | "empty" | "size" | "decode" | "sampling";

export interface LocalVideoState {
  status: LocalVideoStatus;
  /** Object URL of the selected file (revoked on change/unmount). */
  url: string | null;
  info: LocalVideoInfo | null;
  /** Keyframes sampled so far (all of them once `status === "ready"`). */
  frames: Keyframe[];
  /** Keyframes planned for this duration (known before sampling ends). */
  plannedFrames: number;
  error: LocalVideoError | null;
  /** Size of a rejected file (for the "too large" message). */
  rejectedSize: number | null;
  /** Rejected file fits the 10 GB roadmap for heavy camera files. */
  heavy: boolean;
}

const INITIAL: LocalVideoState = {
  status: "idle",
  url: null,
  info: null,
  frames: [],
  plannedFrames: 0,
  error: null,
  rejectedSize: null,
  heavy: false,
};

/**
 * Browser-only video ingest: validates the file (≤ 250 MB), opens it as a
 * local object URL (zero upload, zero server storage), reads its metadata
 * and samples compressed keyframes whose number depends on the duration.
 */
export function useLocalVideo() {
  const [state, setState] = useState<LocalVideoState>(INITIAL);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const release = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => release, [release]);

  const clear = useCallback(() => {
    release();
    setState(INITIAL);
  }, [release]);

  /** Loads a file; resolves false when it was rejected or unreadable. */
  const selectFile = useCallback(
    async (file: File): Promise<boolean> => {
      const check = checkVideoFile(file);
      if (!check.ok) {
        // Keep the current video: a rejected pick shouldn't discard it.
        setState((s) => ({
          ...s,
          error: check.reason,
          rejectedSize: file.size,
          heavy: check.heavy,
        }));
        return false;
      }

      release();
      const controller = new AbortController();
      abortRef.current = controller;
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      setState({ ...INITIAL, status: "reading", url });

      let info: LocalVideoInfo;
      try {
        const meta = await readVideoMetadata(url);
        info = {
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          durationSec: meta.durationSec,
          width: meta.width,
          height: meta.height,
        };
      } catch {
        if (controller.signal.aborted) return false;
        setState((s) => ({ ...s, status: "error", error: "decode" }));
        return false;
      }
      if (controller.signal.aborted) return false;

      const timestamps = planKeyframeTimestamps(info.durationSec);
      setState((s) => ({
        ...s,
        status: "sampling",
        info,
        plannedFrames: timestamps.length,
      }));

      try {
        const frames = await extractKeyframes(url, timestamps, {
          signal: controller.signal,
          onProgress: (_done, _total, frame) => {
            if (!controller.signal.aborted) {
              setState((s) => ({ ...s, frames: [...s.frames, frame] }));
            }
          },
        });
        if (controller.signal.aborted) return false;
        setState((s) => ({ ...s, status: "ready", frames }));
        return true;
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return false;
        setState((s) => ({ ...s, status: "error", error: "sampling" }));
        return false;
      }
    },
    [release],
  );

  const dismissError = useCallback(
    () =>
      setState((s) => ({
        ...s,
        error: s.status === "error" ? s.error : null,
        rejectedSize: null,
        heavy: false,
      })),
    [],
  );

  return { ...state, selectFile, clear, dismissError };
}
