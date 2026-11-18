"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getClientLocale, t } from "@/i18n/runtime";
import {
  parseSessionReminder,
  sessionReminderText,
} from "@/lib/content-planner/reminders";
import { openSessionInPlanner } from "@/components/content-planner/open-in-planner";
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
  // Read through a ref: callers pass inline callbacks (TopBar), which must
  // not re-run the effect on every render.
  const onNotificationNewRef = useRef(options.onNotificationNew);
  onNotificationNewRef.current = options.onNotificationNew;
  // Handlers outlive renders: read the router through a ref.
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    // Only this hook's own handlers are removed on cleanup: other listeners
    // of the same events (e.g. useLiveSpeechToText's "stt:result") stay.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- socket.io listener signature
    type Listener = (...args: any[]) => void;
    const subscriptions: Array<[string, Listener]> = [];
    const on = (event: string, handler: Listener) => {
      socket!.on(event, handler);
      subscriptions.push([event, handler]);
    };

    function attach() {
      if (attachedRef.current || !socket) return;
      attachedRef.current = true;

      on("tool_job_updated", (data: ToolJobUpdatePayload) => {
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

      on("stt:result", (data?: { endedBy?: string }) => {
        fetchBalance();
        // The recording stopped because the balance ran out (Admin → Voice
        // price per second): say why the mic went off.
        if (data?.endedBy === "credit-limit") {
          toast.error(t("voice.errors.outOfCredits"));
        }
      });

      on("stt:error", (data: { code: string; message: string }) => {
        if (data.code === "INSUFFICIENT_CREDITS") {
          toast.error(localizeError(data.message));
          useTranslatorStore.getState().setListening(false);
        }
      });

      on("notification:new", (notification: any) => {
        const reminder = parseSessionReminder(notification);
        if (reminder) {
          // "You have “Record intro” at 10:00 AM" in the user's language.
          const text = sessionReminderText(
            reminder,
            notification.createdAt ?? new Date(),
            getClientLocale(),
          );
          toast.info(text.title, {
            description: text.message,
            duration: 15_000,
            action: {
              label: t("contentPlanner.reminders.open"),
              onClick: () =>
                openSessionInPlanner(reminder, (url) =>
                  routerRef.current.push(url),
                ),
            },
          });
        } else if (notification.title) {
          // Show toast for new notifications
          toast.info(notification.title, {
            description: notification.body,
          });
        }

        // Call callback if provided
        onNotificationNewRef.current?.(notification);
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
      for (const [event, handler] of subscriptions) socket.off(event, handler);
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
