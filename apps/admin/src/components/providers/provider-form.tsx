"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@creator-hub/ui";
import { Toggle } from "@/components/ui/toggle";
import type { Provider } from "@/types";

interface ProviderFormProps {
  provider?: Provider;
  onSubmit: (data: any) => Promise<void>;
}

export function ProviderForm({ provider, onSubmit }: ProviderFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: provider?.slug ?? "",
    name: provider?.name ?? "",
    model: provider?.model ?? "",
    tier: provider?.tier ?? "FREE",
    costPerCredit: provider?.costPerCredit ?? 1,
    isActive: provider?.isActive ?? true,
    supportedTasks: provider?.supportedTasks?.join(", ") ?? "thumbnail",
    config: provider?.config ? JSON.stringify(provider.config, null, 2) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateConfig = (configStr: string): boolean => {
    try {
      if (!configStr) return true;
      JSON.parse(configStr);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (form.config && !validateConfig(form.config)) {
        throw new Error("Invalid JSON configuration");
      }

      const payload = {
        ...form,
        supportedTasks: form.supportedTasks
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        config: form.config ? JSON.parse(form.config) : undefined,
      };

      await onSubmit(payload);
      router.push("/providers");
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Failed to save provider",
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
          <label
            htmlFor="slug"
            className="mb-1 block text-sm font-medium text-text-muted"
          >
            Slug
          </label>
          <Input
            id="slug"
            value={form.slug}
            onChange={(e) => updateField("slug", e.target.value)}
            required
            disabled={!!provider}
          />
          {provider && (
            <p className="mt-1 text-xs text-text-dim">Slug cannot be changed</p>
          )}
        </div>

        <div>
          <label
            htmlFor="provider-name"
            className="mb-1 block text-sm font-medium text-text-muted"
          >
            Name
          </label>
          <Input
            id="provider-name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
          />
        </div>
        <div>
          <label
            htmlFor="model"
            className="mb-1 block text-sm font-medium text-text-muted"
          >
            Model
          </label>
          <Input
            id="model"
            name="model"
            value={form.model}
            onChange={(e) => updateField("model", e.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="tier"
            className="mb-1 block text-sm font-medium text-text-muted"
          >
            Tier
          </label>
          <select
            id="tier"
            name="tier"
            value={form.tier}
            onChange={(e) => updateField("tier", e.target.value)}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
          >
            <option value="FREE">FREE</option>
            <option value="PRO">PRO</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="costPerCredit"
            className="mb-1 block text-sm font-medium text-text-muted"
          >
            Cost per Credit
          </label>
          <Input
            id="costPerCredit"
            name="costPerCredit"
            type="number"
            min={0.01}
            step="0.01"
            value={form.costPerCredit}
            onChange={(e) =>
              updateField("costPerCredit", parseFloat(e.target.value) || 0)
            }
            required
          />
        </div>

        <div>
          <label
            htmlFor="supportedTasks"
            className="mb-1 block text-sm font-medium text-text-muted"
          >
            Supported Tasks
          </label>
          <Input
            id="supportedTasks"
            name="supportedTasks"
            value={form.supportedTasks}
            onChange={(e) => updateField("supportedTasks", e.target.value)}
            placeholder="thumbnail, title-generator"
            required
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated/50 p-4 space-y-4">
        <p className="text-sm font-medium text-text-muted">Configuration</p>
        <div>
          <label
            htmlFor="config"
            className="mb-1 block text-sm font-medium text-text-muted"
          >
            Config (JSON)
          </label>
          <textarea
            id="config"
            value={form.config}
            onChange={(e) => updateField("config", e.target.value)}
            rows={5}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text font-mono"
            placeholder='{"apiKey": "...", "baseUrl": "..."}'
          />
          {form.config && !validateConfig(form.config) && (
            <p className="mt-1 text-xs text-error">Invalid JSON format</p>
          )}
        </div>
      </div>

      {/* ✅ 6. Toggle nativo como en UserForm */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="provider-active"
          className="relative inline-flex cursor-pointer items-center"
        >
          <input
            id="provider-active"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => updateField("isActive", e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-6 w-11 rounded-full bg-border peer-checked:bg-primary transition-colors" />
          <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          <span className="ml-2 text-sm text-text-muted">Active</span>
        </label>
      </div>

      {/* Botones */}
      <div className="flex items-center gap-3 pt-4">
        <Button type="submit" isLoading={loading}>
          {provider ? "Update Provider" : "Create Provider"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/providers")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
