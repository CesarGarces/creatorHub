"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { t } from "@/i18n/runtime";
import { localizeError } from "@/i18n/errors";
import { useGenerationStore } from "@/store/generation.store";
import { useTranslatorStore } from "@/store/translator.store";
import { useVideoStore } from "@/store/video.store";
import { useCreditsStore } from "@/store/credits.store";
import api from "@/lib/api";

const POLL_INTERVAL = 5_000;
const TIMEOUT_MS = 60_000;
const VIDEO_TIMEOUT_MS = 5 * 60_000;

export function useBackgroundPolling() {
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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const activeToolIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = useGenerationStore.subscribe((state) => {
      if (
        state.status === "GENERATING" &&
        state.jobId &&
        state.jobId !== activeJobIdRef.current
      ) {
        activeJobIdRef.current = state.jobId;
        activeToolIdRef.current = state.toolId;
        startPolling(state.toolId!, state.jobId);
      } else if (
        state.status === "IDLE" ||
        state.status === "READY" ||
        state.status === "FAILED"
      ) {
        stopPolling();
        activeJobIdRef.current = null;
        activeToolIdRef.current = null;
      }
    });

    const unsubTranslator = useTranslatorStore.subscribe((state) => {
      if (
        state.status === "GENERATING" &&
        state.jobId &&
        state.jobId !== activeJobIdRef.current
      ) {
        activeJobIdRef.current = state.jobId;
        activeToolIdRef.current = "content-translator";
        startPolling("content-translator", state.jobId);
      } else if (
        state.status === "IDLE" ||
        state.status === "READY" ||
        state.status === "FAILED"
      ) {
        stopPolling();
        activeJobIdRef.current = null;
        activeToolIdRef.current = null;
      }
    });

    const unsubVideo = useVideoStore.subscribe((state) => {
      if (
        state.status === "GENERATING" &&
        state.jobId &&
        state.jobId !== activeJobIdRef.current
      ) {
        activeJobIdRef.current = state.jobId;
        activeToolIdRef.current = "video-generator";
        startPolling("video-generator", state.jobId);
      } else if (
        state.status === "IDLE" ||
        state.status === "READY" ||
        state.status === "FAILED"
      ) {
        stopPolling();
        activeJobIdRef.current = null;
        activeToolIdRef.current = null;
      }
    });

    return () => {
      unsub();
      unsubTranslator();
      unsubVideo();
      stopPolling();
    };
  }, []);

  function startPolling(toolId: string, jobId: string) {
    stopPolling();

    const timeout =
      toolId === "video-generator" ? VIDEO_TIMEOUT_MS : TIMEOUT_MS;

    timeoutRef.current = setTimeout(() => {
      const genCurrent = useGenerationStore.getState().status;
      const transCurrent = useTranslatorStore.getState().status;
      const vidCurrent = useVideoStore.getState().status;
      if (
        genCurrent === "GENERATING" ||
        genCurrent === "REVEALING" ||
        transCurrent === "GENERATING" ||
        transCurrent === "REVEALING" ||
        vidCurrent === "GENERATING" ||
        vidCurrent === "REVEALING"
      ) {
        if (toolId === "content-translator") {
          translatorSetFailed(t("jobs.translationTimeoutDetail"));
          toast.error(t("jobs.translationTimeout"));
        } else if (toolId === "video-generator") {
          videoSetFailed(t("jobs.videoTimeoutDetail"));
          toast.error(t("jobs.videoTimeout"));
        } else {
          setFailed(t("jobs.generationTimeoutDetail"));
          toast.error(t("jobs.generationTimeout"));
        }
        activeJobIdRef.current = null;
      }
    }, timeout);

    pollingRef.current = setInterval(async () => {
      const genCurrent = useGenerationStore.getState().status;
      const transCurrent = useTranslatorStore.getState().status;
      const vidCurrent = useVideoStore.getState().status;
      const isGenerating =
        genCurrent === "GENERATING" || genCurrent === "REVEALING";
      const isTranslating =
        transCurrent === "GENERATING" || transCurrent === "REVEALING";
      const isGeneratingVideo =
        vidCurrent === "GENERATING" || vidCurrent === "REVEALING";

      if (!isGenerating && !isTranslating && !isGeneratingVideo) {
        stopPolling();
        return;
      }

      try {
        const statusRes = await api.get<{
          status: string;
          failedReason?: string;
        }>(`/tools/${toolId}/jobs/${jobId}/status`);

        if (statusRes.status === "completed") {
          stopPolling();

          if (toolId === "content-translator") {
            const translationsRes = await api.get<{ data: any[] }>(
              `/tools/${toolId}/translations?limit=1`,
            );
            const latest = translationsRes?.data?.[0];
            if (latest?.response?.translatedText) {
              translatorSetRevealing(latest.response.translatedText, latest.id);
              translatorSetReady();
              fetchBalance();
              toast.success(t("jobs.translationReady"));
            }
          } else if (toolId === "video-generator") {
            const videosRes = await api.get<{ data: any[] }>(
              `/tools/${toolId}/videos?limit=1`,
            );
            const latest = videosRes?.data?.[0];
            if (latest?.url) {
              videoSetRevealing(latest.url, latest.id);
              videoAddVariation(latest.url, latest.id);
              videoSetReady();
              fetchBalance();
              toast.success(t("jobs.videoReady"));
            }
          } else {
            const imagesRes = await api.get<{ data: any[] }>(
              `/tools/${toolId}/images?limit=1`,
            );
            const latest = imagesRes?.data?.[0];
            if (latest?.url) {
              setRevealing(latest.url, latest.id);
              setReady();
              fetchBalance();
              toast.success(t("jobs.generationReady"));
            }
          }
          activeJobIdRef.current = null;
          activeToolIdRef.current = null;
        } else if (statusRes.status === "failed") {
          stopPolling();
          if (toolId === "content-translator") {
            const reason = localizeError(
              statusRes.failedReason,
              "jobs.translationFailed",
            );
            translatorSetFailed(reason);
            toast.error(reason);
          } else if (toolId === "video-generator") {
            const reason = localizeError(
              statusRes.failedReason,
              "jobs.videoFailed",
            );
            videoSetFailed(reason);
            toast.error(reason);
          } else {
            const reason = localizeError(
              statusRes.failedReason,
              "jobs.generationFailed",
            );
            setFailed(reason);
            toast.error(reason);
          }
          activeJobIdRef.current = null;
          activeToolIdRef.current = null;
        }
      } catch {
        // ignore polling errors
      }
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }
}
