"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGenerationStore } from "@/store/generation.store";
import { useTranslatorStore } from "@/store/translator.store";
import { useCreditsStore } from "@/store/credits.store";
import api from "@/lib/api";

const POLL_INTERVAL = 5_000;
const TIMEOUT_MS = 60_000;

export function useBackgroundPolling() {
  const setRevealing = useGenerationStore((s) => s.setRevealing);
  const setReady = useGenerationStore((s) => s.setReady);
  const setFailed = useGenerationStore((s) => s.setFailed);

  const translatorSetRevealing = useTranslatorStore((s) => s.setRevealing);
  const translatorSetReady = useTranslatorStore((s) => s.setReady);
  const translatorSetFailed = useTranslatorStore((s) => s.setFailed);

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

    return () => {
      unsub();
      unsubTranslator();
      stopPolling();
    };
  }, []);

  function startPolling(toolId: string, jobId: string) {
    stopPolling();

    timeoutRef.current = setTimeout(() => {
      const genCurrent = useGenerationStore.getState().status;
      const transCurrent = useTranslatorStore.getState().status;
      if (
        genCurrent === "GENERATING" ||
        genCurrent === "REVEALING" ||
        transCurrent === "GENERATING" ||
        transCurrent === "REVEALING"
      ) {
        if (toolId === "content-translator") {
          translatorSetFailed(
            "Translation timed out. The AI provider may be unavailable.",
          );
          toast.error("Translation timed out. Please try again.");
        } else {
          setFailed(
            "Generation timed out. The AI provider may be unavailable.",
          );
          toast.error("Generation timed out. Please try again.");
        }
        activeJobIdRef.current = null;
      }
    }, TIMEOUT_MS);

    pollingRef.current = setInterval(async () => {
      const genCurrent = useGenerationStore.getState().status;
      const transCurrent = useTranslatorStore.getState().status;
      const isGenerating =
        genCurrent === "GENERATING" || genCurrent === "REVEALING";
      const isTranslating =
        transCurrent === "GENERATING" || transCurrent === "REVEALING";

      if (!isGenerating && !isTranslating) {
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
              toast.success("Translation ready!");
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
              toast.success("Generation ready!");
            }
          }
          activeJobIdRef.current = null;
          activeToolIdRef.current = null;
        } else if (statusRes.status === "failed") {
          stopPolling();
          if (toolId === "content-translator") {
            translatorSetFailed(statusRes.failedReason || "Translation failed");
            toast.error(statusRes.failedReason || "Translation failed");
          } else {
            setFailed(statusRes.failedReason || "Generation failed");
            toast.error(statusRes.failedReason || "Generation failed");
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
