"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import api, { ApiError } from "@/lib/api";

const SESSION_CHECK_INTERVAL = 30_000;

export function useSessionValidator() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) {
      stopValidation();
      return;
    }

    startValidation();

    return () => stopValidation();
  }, [user]);

  function startValidation() {
    stopValidation();

    intervalRef.current = setInterval(async () => {
      try {
        await api.get<{ id: string }>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          logout();
          router.push("/login");
        }
      }
    }, SESSION_CHECK_INTERVAL);
  }

  function stopValidation() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }
}
