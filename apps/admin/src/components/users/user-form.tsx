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
    isActive: user?.isActive ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
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
      };

      if (!user && form.password) {
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
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Name
          </label>
          <Input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        {!user && (
          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">
              Password
            </label>
            <Input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required={!user}
              minLength={8}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Role
          </label>
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
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
            name="plan"
            value={form.plan}
            onChange={handleChange}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
          >
            <option value="FREE">FREE</option>
            <option value="PAY_AS_YOU_GO">PAY_AS_YOU_GO</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
        </div>
      </div>

      {user && (
        <div className="rounded-lg border border-border bg-surface-elevated/50 p-4 space-y-3">
          <p className="text-sm font-medium text-text-muted">
            Credit Balance (read-only)
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-text-dim">Free Credits</p>
              <p className="text-lg font-semibold text-text">
                {user.freeCredits}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-dim">Purchased Credits</p>
              <p className="text-lg font-semibold text-text">
                {user.purchasedCredits}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-dim">Total Available</p>
              <p className="text-lg font-semibold text-text">
                {user.totalCredits}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isActive"
          id="isActive"
          checked={form.isActive}
          onChange={handleChange}
          className="h-4 w-4 rounded border-border bg-surface text-primary"
        />
        <label htmlFor="isActive" className="text-sm text-text-muted">
          Active
        </label>
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
