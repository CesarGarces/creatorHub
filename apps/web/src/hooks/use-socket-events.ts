"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGenerationStore } from "@/store/generation.store";
import { useCreditsStore } from "@/store/credits.store";
import { connectSocket } from "@/lib/socket";

export function useSocketEvents() {
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

      socket.on("thumbnail_ready", (data: { url: string; imageId: string }) => {
        setReady(data.url, data.imageId);
        fetchBalance();
        toast.success("Thumbnail ready!");
      });

      socket.on("thumbnail_error", (data: { message: string }) => {
        setFailed(data.message);
        toast.error(data.message);
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
      socket.off("thumbnail_ready");
      socket.off("thumbnail_error");
      attachedRef.current = false;
    };
  }, [setReady, setFailed, fetchBalance]);
}
