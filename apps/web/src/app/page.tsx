"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useI18n } from "@/i18n/i18n-provider";

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    if (user) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [isHydrated, user, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/isologo_white.png"
          alt={t("common.appName")}
          className="h-14 w-auto animate-pulse-glow"
        />
        <div className="h-2 w-24 rounded-full shimmer" />
      </div>
    </div>
  );
}
