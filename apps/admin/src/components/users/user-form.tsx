"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@creator-hub/ui";
import type { User } from "@/types";

interface UserFormProps {
  user?: User;
  onSubmit: (data: any) => Promise<void>;
}

export function UserForm({ user, onSubmit }: UserFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: user?.email ?? "",
    name: user?.name ?? "",
    password: "",
    role: user?.role ?? "USER",
    plan: user?.plan ?? "FREE",
    currentCredits: user?.currentCredits ?? 0,
    purchasedCredits: user?.purchasedCredits ?? 0,
    isActive: user?.isActive ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: any = {
        email: form.email,
        name: form.name,
        role: form.role,
        plan: form.plan,
        isActive: form.isActive,
        currentCredits: form.currentCredits,
        purchasedCredits: form.purchasedCredits,
      };

      if (form.password) {
        payload.password = form.password;
      }

      await onSubmit(payload);
      router.push("/users");
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Failed to save user",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-border bg-surface p-6"
    >
      {error && (
        <div className="rounded-lg bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Email
          </label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Name
          </label>
          <Input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            {user ? "New Password (leave blank to keep)" : "Password"}
          </label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            required={!user}
            minLength={8}
            placeholder={user ? "Leave blank to keep current" : undefined}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Role
          </label>
          <select
            value={form.role}
            onChange={(e) => updateField("role", e.target.value)}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Plan
          </label>
          <select
            value={form.plan}
            onChange={(e) => updateField("plan", e.target.value)}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
          >
            <option value="FREE">FREE</option>
            <option value="PAY_AS_YOU_GO">PAY_AS_YOU_GO</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated/50 p-4 space-y-4">
        <p className="text-sm font-medium text-text-muted">Credit Balance</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-text-dim">
              Current Credits
            </label>
            <Input
              type="number"
              min={0}
              value={form.currentCredits}
              onChange={(e) =>
                updateField("currentCredits", parseInt(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-dim">
              Purchased Credits
            </label>
            <Input
              type="number"
              min={0}
              value={form.purchasedCredits}
              onChange={(e) =>
                updateField("purchasedCredits", parseInt(e.target.value) || 0)
              }
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => updateField("isActive", e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-6 w-11 rounded-full bg-border peer-checked:bg-primary transition-colors" />
          <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </label>
        <span className="text-sm text-text-muted">Active</span>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <Button type="submit" isLoading={loading}>
          {user ? "Update User" : "Create User"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/users")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
