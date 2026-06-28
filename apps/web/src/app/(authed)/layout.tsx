"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useSocketEvents } from "@/hooks/use-socket-events";
import { useBackgroundPolling } from "@/hooks/use-background-polling";
import { useSessionValidator } from "@/hooks/use-session-validator";

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const { fetchBalance } = useCreditsStore();

  useSocketEvents();
  useBackgroundPolling();
  useSessionValidator();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && user) {
      fetchBalance();
    }
  }, [isHydrated, user, fetchBalance]);

  useEffect(() => {
    if (isHydrated && !user) {
      router.push("/login");
    }
  }, [isHydrated, user, router]);

  useEffect(() => {
    if (isHydrated && user && !user.emailVerified) {
      router.push("/auth/verify");
    }
  }, [isHydrated, user, router]);

  if (!isHydrated || !user) return null;
  if (!user.emailVerified) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}
