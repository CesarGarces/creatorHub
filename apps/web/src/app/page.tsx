"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [user, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white font-bold text-xl animate-pulse-glow">
          C
        </div>
        <div className="h-2 w-24 rounded-full shimmer" />
      </div>
    </div>
  );
}
