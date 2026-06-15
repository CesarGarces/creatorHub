"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";

export default function Home() {
  const router = useRouter();
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
          alt="Creator Hub"
          className="h-14 w-auto animate-pulse-glow"
        />
        <div className="h-2 w-24 rounded-full shimmer" />
      </div>
    </div>
  );
}
