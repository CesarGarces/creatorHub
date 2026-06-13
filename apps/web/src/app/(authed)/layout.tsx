"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const { fetchBalance } = useCreditsStore();

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

  if (!isHydrated || !user) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}
