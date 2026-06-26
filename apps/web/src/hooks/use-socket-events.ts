"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGenerationStore } from "@/store/generation.store";
import { useTranslatorStore } from "@/store/translator.store";
import { useVideoStore } from "@/store/video.store";
import { useCreditsStore } from "@/store/credits.store";
import { connectSocket } from "@/lib/socket";
import type { ToolJobUpdatePayload } from "@creator-hub/shared-types";

export function useSocketEvents() {
  const setRevealing = useGenerationStore((s) => s.setRevealing);
  const setReady = useGenerationStore((s) => s.setReady);
  const setFailed = useGenerationStore((s) => s.setFailed);

  const translatorSetRevealing = useTranslatorStore((s) => s.setRevealing);
  const translatorSetReady = useTranslatorStore((s) => s.setReady);
  const translatorSetFailed = useTranslatorStore((s) => s.setFailed);

  const videoSetRevealing = useVideoStore((s) => s.setRevealing);
  const videoSetReady = useVideoStore((s) => s.setReady);
  const videoSetFailed = useVideoStore((s) => s.setFailed);
  const videoAddVariation = useVideoStore((s) => s.addVariation);

  const fetchBalance = useCreditsStore((s) => s.fetchBalance);
  const attachedRef = useRef(false);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    function attach() {
      if (attachedRef.current || !socket) return;
      attachedRef.current = true;

      socket.on("tool_job_updated", (data: ToolJobUpdatePayload) => {
        if (data.status === "completed") {
          const payload = data.payload as {
            url?: string;
            content?: string;
            imageId?: string;
            translationId?: string;
            videoId?: string;
          };

          if (data.toolId === "video-generator" && payload.url) {
            videoSetRevealing(payload.url, payload.videoId || "");
            videoAddVariation(payload.url, payload.videoId || "");
            videoSetReady();
            fetchBalance();
            toast.success("Video ready!");
          } else if (payload.url) {
            const genStore = useGenerationStore.getState();
            if (genStore.toolId === data.toolId) {
              setRevealing(payload.url, payload.imageId || "");
              setReady();
              fetchBalance();
              toast.success("Generation ready!");
            }
          } else if (payload.content) {
            const transStore = useTranslatorStore.getState();
            if (data.toolId === "content-translator") {
              translatorSetRevealing(
                payload.content,
                payload.translationId || "",
              );
              translatorSetReady();
              fetchBalance();
              toast.success("Translation ready!");
            }
          }
        } else if (data.status === "failed") {
          const payload = data.payload as { error?: string };

          if (data.toolId === "video-generator") {
            const vidStore = useVideoStore.getState();
            if (vidStore.status === "GENERATING") {
              videoSetFailed(payload.error || "Video generation failed");
              toast.error(payload.error || "Video generation failed");
            }
          } else if (data.toolId === "content-translator") {
            const transStore = useTranslatorStore.getState();
            if (transStore.status === "GENERATING") {
              translatorSetFailed(payload.error || "Translation failed");
              toast.error(payload.error || "Translation failed");
            }
          } else {
            const genStore = useGenerationStore.getState();
            if (genStore.toolId === data.toolId) {
              setFailed(payload.error || "Generation failed");
              toast.error(payload.error || "Generation failed");
            }
          }
        }
      });

      socket.on("stt:result", () => {
        fetchBalance();
      });

      socket.on("stt:error", (data: { code: string; message: string }) => {
        if (data.code === "INSUFFICIENT_CREDITS") {
          toast.error(data.message);
          useTranslatorStore.getState().setListening(false);
        }
      });
    }

    if (socket.connected) {
      attach();
    } else {
      socket.on("connect", attach);
      socket.connect();
    }

    return () => {
      socket.off("connect", attach);
      socket.off("tool_job_updated");
      socket.off("stt:result");
      socket.off("stt:error");
      attachedRef.current = false;
    };
  }, [
    setRevealing,
    setReady,
    setFailed,
    translatorSetRevealing,
    translatorSetReady,
    translatorSetFailed,
    videoSetRevealing,
    videoSetReady,
    videoSetFailed,
    videoAddVariation,
    fetchBalance,
  ]);
}
