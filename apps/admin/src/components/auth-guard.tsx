"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    // Decode JWT to check role
    try {
      const parts = token.split(".");
      if (parts.length !== 3 || !parts[1]) {
        localStorage.removeItem("admin_token");
        router.replace("/login");
        return;
      }
      const payload = JSON.parse(atob(parts[1]));
      if (payload.role !== "ADMIN") {
        localStorage.removeItem("admin_token");
        router.replace("/login");
        return;
      }
      setIsAuthenticated(true);
    } catch {
      localStorage.removeItem("admin_token");
      router.replace("/login");
    } finally {
      setIsLoading(false);
    }
  }, [router, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
