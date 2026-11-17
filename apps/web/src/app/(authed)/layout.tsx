"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
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

  // Until the session is restored (and while redirecting away), the server-
  // rendered shell skeleton keeps the first paint instant and the layout
  // stable — instead of a blank page.
  if (!isHydrated || !user) return <AppShellSkeleton />;
  if (!user.emailVerified) return <AppShellSkeleton />;

  return <DashboardLayout>{children}</DashboardLayout>;
}
