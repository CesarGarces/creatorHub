"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { t } from "@/i18n/runtime";
import { localizeError } from "@/i18n/errors";
import { useGenerationStore } from "@/store/generation.store";
import { useTranslatorStore } from "@/store/translator.store";
import { useVideoStore } from "@/store/video.store";
import { useCreditsStore } from "@/store/credits.store";
import { connectSocket } from "@/lib/socket";
import type { ToolJobUpdatePayload } from "@creator-hub/shared-types";

interface UseSocketEventsOptions {
  onNotificationNew?: (notification: any) => void;
}

export function useSocketEvents(options: UseSocketEventsOptions = {}) {
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
            toast.success(t("jobs.videoReady"));
          } else if (payload.url) {
            const genStore = useGenerationStore.getState();
            if (genStore.toolId === data.toolId) {
              setRevealing(payload.url, payload.imageId || "");
              setReady();
              fetchBalance();
              toast.success(t("jobs.generationReady"));
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
              toast.success(t("jobs.translationReady"));
            }
          }
        } else if (data.status === "failed") {
          const payload = data.payload as { error?: string };

          if (data.toolId === "video-generator") {
            const vidStore = useVideoStore.getState();
            if (vidStore.status === "GENERATING") {
              const reason = localizeError(payload.error, "jobs.videoFailed");
              videoSetFailed(reason);
              toast.error(reason);
            }
          } else if (data.toolId === "content-translator") {
            const transStore = useTranslatorStore.getState();
            if (transStore.status === "GENERATING") {
              const reason = localizeError(
                payload.error,
                "jobs.translationFailed",
              );
              translatorSetFailed(reason);
              toast.error(reason);
            }
          } else {
            const genStore = useGenerationStore.getState();
            if (genStore.toolId === data.toolId) {
              const reason = localizeError(
                payload.error,
                "jobs.generationFailed",
              );
              setFailed(reason);
              toast.error(reason);
            }
          }
        }
      });

      socket.on("stt:result", () => {
        fetchBalance();
      });

      socket.on("stt:error", (data: { code: string; message: string }) => {
        if (data.code === "INSUFFICIENT_CREDITS") {
          toast.error(localizeError(data.message));
          useTranslatorStore.getState().setListening(false);
        }
      });

      socket.on("notification:new", (notification: any) => {
        // Show toast for new notifications
        if (notification.title) {
          toast.info(notification.title, {
            description: notification.body,
          });
        }

        // Call callback if provided
        if (options.onNotificationNew) {
          options.onNotificationNew(notification);
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
      socket.off("notification:new");
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
    options.onNotificationNew,
  ]);
}
