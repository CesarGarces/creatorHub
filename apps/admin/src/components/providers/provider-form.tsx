"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Badge } from "@creator-hub/ui";
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

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : name === "costPerCredit"
            ? parseInt(value) || 0
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
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
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Slug
          </label>
          <Input
            name="slug"
            value={form.slug}
            onChange={handleChange}
            required
            disabled={!!provider}
          />
          {provider && (
            <p className="mt-1 text-xs text-text-dim">Slug cannot be changed</p>
          )}
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

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Model
          </label>
          <Input
            name="model"
            value={form.model}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Tier
          </label>
          <select
            name="tier"
            value={form.tier}
            onChange={handleChange}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
          >
            <option value="FREE">FREE</option>
            <option value="PRO">PRO</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Cost per Credit
          </label>
          <Input
            name="costPerCredit"
            type="number"
            min={1}
            value={form.costPerCredit}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-muted">
            Supported Tasks
          </label>
          <Input
            name="supportedTasks"
            value={form.supportedTasks}
            onChange={handleChange}
            placeholder="thumbnail, title-generator"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text-muted">
          Config (JSON)
        </label>
        <textarea
          name="config"
          value={form.config}
          onChange={handleChange}
          rows={5}
          className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text font-mono"
          placeholder='{"apiKey": "...", "baseUrl": "..."}'
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isActive"
          id="isActive"
          checked={form.isActive}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, isActive: e.target.checked }))
          }
          className="h-4 w-4 rounded border-border bg-surface text-primary"
        />
        <label htmlFor="isActive" className="text-sm text-text-muted">
          Active
        </label>
      </div>

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
