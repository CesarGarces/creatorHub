"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGenerationStore } from "@/store/generation.store";
import { useCreditsStore } from "@/store/credits.store";
import { connectSocket } from "@/lib/socket";
import type { ToolJobUpdatePayload } from "@creator-hub/shared-types";

export function useSocketEvents() {
  const setRevealing = useGenerationStore((s) => s.setRevealing);
  const setReady = useGenerationStore((s) => s.setReady);
  const setFailed = useGenerationStore((s) => s.setFailed);
  const fetchBalance = useCreditsStore((s) => s.fetchBalance);
  const attachedRef = useRef(false);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    function attach() {
      if (attachedRef.current || !socket) return;
      attachedRef.current = true;

      socket.on("tool_job_updated", (data: ToolJobUpdatePayload) => {
        const store = useGenerationStore.getState();
        if (store.toolId !== data.toolId) return;

        if (data.status === "completed") {
          const payload = data.payload as { url?: string; imageId?: string };
          if (payload.url) {
            setRevealing(payload.url, payload.imageId || "");
            setReady();
            fetchBalance();
            toast.success("Thumbnail ready!");
          }
        } else if (data.status === "failed") {
          const payload = data.payload as { error?: string };
          setFailed(payload.error || "Generation failed");
          toast.error(payload.error || "Generation failed");
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
      attachedRef.current = false;
    };
  }, [setReady, setFailed, fetchBalance]);
}
