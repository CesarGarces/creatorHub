"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGenerationStore } from "@/store/generation.store";
import { useCreditsStore } from "@/store/credits.store";
import api from "@/lib/api";

const POLL_INTERVAL = 5_000;
const TIMEOUT_MS = 60_000;

export function useBackgroundPolling() {
  const setRevealing = useGenerationStore((s) => s.setRevealing);
  const setReady = useGenerationStore((s) => s.setReady);
  const setFailed = useGenerationStore((s) => s.setFailed);
  const fetchBalance = useCreditsStore((s) => s.fetchBalance);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = useGenerationStore.subscribe((state) => {
      if (state.status === "GENERATING" && state.jobId && state.jobId !== activeJobIdRef.current) {
        activeJobIdRef.current = state.jobId;
        startPolling(state.toolId!, state.jobId);
      } else if (state.status === "IDLE" || state.status === "READY" || state.status === "FAILED") {
        stopPolling();
        activeJobIdRef.current = null;
      }
    });

    return () => {
      unsub();
      stopPolling();
    };
  }, []);

  function startPolling(toolId: string, jobId: string) {
    stopPolling();

    timeoutRef.current = setTimeout(() => {
      const current = useGenerationStore.getState().status;
      if (current === "GENERATING" || current === "REVEALING") {
        setFailed("Generation timed out. The AI provider may be unavailable.");
        toast.error("Generation timed out. Please try again.");
        activeJobIdRef.current = null;
      }
    }, TIMEOUT_MS);

    pollingRef.current = setInterval(async () => {
      const current = useGenerationStore.getState().status;
      if (current !== "GENERATING" && current !== "REVEALING") {
        stopPolling();
        return;
      }
      try {
        const statusRes = await api.get<{ status: string; failedReason?: string }>(
          `/tools/${toolId}/jobs/${jobId}/status`
        );
        if (statusRes.status === "completed") {
          stopPolling();
          const imagesRes = await api.get<{ data: any[] }>(
            `/tools/${toolId}/images?limit=1`
          );
          const latest = imagesRes?.data?.[0];
          if (latest?.url) {
            setRevealing(latest.url, latest.id);
            setReady();
            fetchBalance();
            toast.success("Thumbnail ready!");
          }
          activeJobIdRef.current = null;
        } else if (statusRes.status === "failed") {
          stopPolling();
          setFailed(statusRes.failedReason || "Generation failed");
          toast.error(statusRes.failedReason || "Generation failed");
          activeJobIdRef.current = null;
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
