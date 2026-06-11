"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { Button, Input, Card, CardContent, CardHeader } from "@creator-hub/ui";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />

      <Card className="w-full max-w-md relative z-10 border-border/50 bg-surface/90 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white font-bold text-xl">
            C
          </div>
          <h1 className="text-2xl font-bold text-text">Welcome to Creator Hub</h1>
          <p className="text-sm text-text-muted">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-error/10 border border-error/20 p-3 text-sm text-error">{error}</div>
            )}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Button type="submit" isLoading={isLoading} variant="glow" className="w-full" size="lg">
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <a href="/register" className="text-primary hover:text-primary-hover font-medium transition-colors">
              Register
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
