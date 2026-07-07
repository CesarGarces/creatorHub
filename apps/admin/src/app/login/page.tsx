"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button, Input } from "@creator-hub/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/admin/login", { email, password });
      const token =
        response.data?.data?.accessToken || response.data?.accessToken;
      if (!token) {
        setError("Invalid credentials");
        return;
      }
      localStorage.setItem("admin_token", token);
      document.cookie = `admin_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      router.push("/");
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-surface p-8">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <Image
              src="/isologo_white.png"
              alt="Creator Hub"
              width={512}
              height={512}
              className="h-auto w-56"
              priority
              sizes="224px"
            />
          </div>
          <h1 className="text-2xl font-bold text-text">Admin Login</h1>
          <p className="mt-2 text-sm text-text-muted">
            Sign in to access the admin panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-text-muted"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-text-muted"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
