"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  Power,
  PowerOff,
  Settings2,
  BrainCircuit,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Button,
  Input,
  Badge,
  Skeleton,
  Switch,
  ActionConfirmDialog,
} from "@creator-hub/ui";
import { useDebounce } from "@/hooks/use-debounce";
import { ModelDetailModal } from "@/components/models/model-detail-modal";
import type { ModelMetadata, ModelStats, PaginatedResponse } from "@/types";

const TASK_TYPES = [
  { value: "", label: "All Types" },
  { value: "image-generation", label: "Image" },
  { value: "text-generation", label: "Text" },
  { value: "video-generation", label: "Video" },
];

const TIERS = [
  { value: "", label: "All Tiers" },
  { value: "FREE", label: "Free" },
  { value: "PRO", label: "Pro" },
];

const PROVIDERS = [
  { value: "", label: "All Providers" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "siliconflow", label: "SiliconFlow" },
];

const taskTypeColor: Record<string, string> = {
  "image-generation": "bg-purple-100 text-purple-700",
  "text-generation": "bg-blue-100 text-blue-700",
  "video-generation": "bg-orange-100 text-orange-700",
};

export default function ModelsPage() {
  // Data
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [taskType, setTaskType] = useState("");
  const [tier, setTier] = useState("");
  const [providerSlug, setProviderSlug] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  // UI state
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    modelId: string | null;
  }>({ open: false, modelId: null });

  // Confirmation dialog for toggling active/inactive
  const [toggleDialog, setToggleDialog] = useState<{
    isOpen: boolean;
    model: ModelMetadata | null;
  }>({ isOpen: false, model: null });

  // Inline editing
  const [editingCell, setEditingCell] = useState<{
    modelId: string;
    field: "tier" | "taskType";
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  // ──────────────────────────────────────────────
  // Fetching
  // ──────────────────────────────────────────────

  const fetchModels = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params: Record<string, string> = {
          page: String(page),
          limit: "20",
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (taskType) params.taskType = taskType;
        if (tier) params.tier = tier;
        if (providerSlug) params.providerSlug = providerSlug;
        if (!showInactive) params.isActive = "true";

        const res = await api.get<PaginatedResponse<ModelMetadata>>(
          "/admin/models",
          { params },
        );
        setModels(res.data.data);
        setMeta(res.data.meta);
      } catch {
        toast.error("Failed to load models");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, taskType, tier, providerSlug, showInactive],
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<ModelStats>("/admin/models/stats");
      setStats(res.data);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchModels(1);
  }, [fetchModels]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ──────────────────────────────────────────────
  // Selection
  // ──────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === models.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(models.map((m) => m.id)));
    }
  };

  // ──────────────────────────────────────────────
  // Bulk actions
  // ──────────────────────────────────────────────

  const handleBulkAction = async (isActive: boolean) => {
    if (selected.size === 0) return;
    try {
      await api.put("/admin/models/bulk", {
        ids: Array.from(selected),
        isActive,
      });
      toast.success(
        `${selected.size} model${selected.size > 1 ? "s" : ""} ${isActive ? "activated" : "deactivated"}`,
      );
      setSelected(new Set());
      fetchModels(meta.page);
      fetchStats();
    } catch {
      toast.error("Bulk update failed");
    }
  };

  // ──────────────────────────────────────────────
  // Sync
  // ──────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/admin/models/sync");
      toast.success("Model sync started — refreshing...");
      setTimeout(() => {
        fetchModels(1);
        fetchStats();
      }, 2000);
    } catch {
      toast.error("Sync request failed");
    } finally {
      setSyncing(false);
    }
  };

  // ──────────────────────────────────────────────
  // Toggle active with confirmation
  // ──────────────────────────────────────────────

  const handleToggleClick = (model: ModelMetadata) => {
    setToggleDialog({ isOpen: true, model });
  };

  const handleToggleConfirm = async () => {
    const model = toggleDialog.model;
    if (!model) return;

    const newActive = !model.isActive;
    try {
      await api.put(`/admin/models/${model.id}/config`, {
        isActive: newActive,
      });
      setModels((prev) =>
        prev.map((m) =>
          m.id === model.id ? { ...m, isActive: newActive } : m,
        ),
      );
      toast.success(
        `${model.displayName} ${newActive ? "activated" : "deactivated"}`,
      );
      fetchStats();
    } catch {
      toast.error("Failed to update model");
    } finally {
      setToggleDialog({ isOpen: false, model: null });
    }
  };

  // ──────────────────────────────────────────────
  // Inline editing (tier, taskType)
  // ──────────────────────────────────────────────

  const startEditing = (
    modelId: string,
    field: "tier" | "taskType",
    currentValue: string,
  ) => {
    setEditingCell({ modelId, field });
    setEditValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveEditing = async () => {
    if (!editingCell) return;
    setSaving(true);
    try {
      await api.put(`/admin/models/${editingCell.modelId}/config`, {
        [editingCell.field]: editValue,
      });
      setModels((prev) =>
        prev.map((m) =>
          m.id === editingCell.modelId
            ? { ...m, [editingCell.field]: editValue }
            : m,
        ),
      );
      toast.success(
        `${editingCell.field === "tier" ? "Tier" : "Task type"} updated`,
      );
      cancelEditing();
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const isEditing = (modelId: string, field: string) =>
    editingCell?.modelId === modelId && editingCell?.field === field;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">AI Models</h1>
          <p className="text-text-muted">
            Manage model registry, pricing, and availability
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline">
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync Models
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-dim">Total</p>
            <p className="text-2xl font-bold text-text">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-dim">Active</p>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.active}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-dim">Image</p>
            <p className="text-2xl font-bold text-purple-600">
              {stats.byTaskType["image-generation"] ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-dim">Text</p>
            <p className="text-2xl font-bold text-blue-600">
              {stats.byTaskType["text-generation"] ?? 0}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
        >
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
        >
          {TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={providerSlug}
          onChange={(e) => setProviderSlug(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          <span className="text-sm text-text-muted">Show inactive</span>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm text-text">{selected.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkAction(true)}
          >
            <Power className="mr-1.5 h-3.5 w-3.5" />
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkAction(false)}
          >
            <PowerOff className="mr-1.5 h-3.5 w-3.5" />
            Deactivate
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={models.length > 0 && selected.size === models.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
              </th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium text-right">Credits</th>
              <th className="px-4 py-3 font-medium text-right">Margin</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={9} className="px-4 py-4">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : models.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-text-dim"
                >
                  <BrainCircuit className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <p>No models found</p>
                  <p className="mt-1 text-xs">
                    Try adjusting your filters or sync models from providers
                  </p>
                </td>
              </tr>
            ) : (
              models.map((model) => (
                <tr
                  key={model.id}
                  className={`hover:bg-surface-elevated/30 ${
                    !model.isActive ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(model.id)}
                      onChange={() => toggleSelect(model.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-text">
                        {model.displayName}
                      </p>
                      <p className="max-w-[240px] truncate font-mono text-xs text-text-dim">
                        {model.modelId}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" size="sm">
                      {model.providerSlug}
                    </Badge>
                  </td>

                  {/* Task Type — clickable to edit inline */}
                  <td className="px-4 py-3">
                    {isEditing(model.id, "taskType") ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="rounded border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="image-generation">Image</option>
                          <option value="text-generation">Text</option>
                          <option value="video-generation">Video</option>
                        </select>
                        <button
                          type="button"
                          onClick={saveEditing}
                          disabled={saving}
                          className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="rounded p-0.5 text-text-dim hover:bg-surface-elevated"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(model.id, "taskType", model.taskType)
                        }
                        className={`cursor-pointer rounded px-2 py-0.5 text-xs font-medium hover:opacity-80 ${taskTypeColor[model.taskType] ?? ""}`}
                      >
                        {model.taskType.replace("-generation", "")}
                      </button>
                    )}
                  </td>

                  {/* Tier — clickable to edit inline */}
                  <td className="px-4 py-3">
                    {isEditing(model.id, "tier") ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="rounded border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="FREE">Free</option>
                          <option value="PRO">Pro</option>
                        </select>
                        <button
                          type="button"
                          onClick={saveEditing}
                          disabled={saving}
                          className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="rounded p-0.5 text-text-dim hover:bg-surface-elevated"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          startEditing(model.id, "tier", model.tier)
                        }
                        className={`cursor-pointer rounded px-2 py-0.5 text-xs font-medium hover:opacity-80 ${
                          model.tier === "PRO"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {model.tier}
                      </button>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-text">
                    {model.creditCost}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text">
                    {model.profitMargin}×
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={model.isActive ? "secondary" : "outline"}
                      size="sm"
                    >
                      {model.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Switch
                        checked={model.isActive}
                        onCheckedChange={() => handleToggleClick(model)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDetailModal({ open: true, modelId: model.id })
                        }
                        aria-label={`Configure ${model.displayName}`}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Page {meta.page} of {meta.totalPages} ({meta.total} models)
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => fetchModels(meta.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchModels(meta.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Toggle confirmation dialog */}
      <ActionConfirmDialog
        isOpen={toggleDialog.isOpen}
        onClose={() => setToggleDialog({ isOpen: false, model: null })}
        onConfirm={handleToggleConfirm}
        title={
          toggleDialog.model?.isActive ? "Deactivate Model" : "Activate Model"
        }
        description={
          toggleDialog.model?.isActive
            ? `Are you sure you want to deactivate "${toggleDialog.model?.displayName}"? It will no longer be available for use.`
            : `Are you sure you want to activate "${toggleDialog.model?.displayName}"? It will become available for use.`
        }
        confirmLabel={toggleDialog.model?.isActive ? "Deactivate" : "Activate"}
        cancelLabel="Cancel"
        confirmVariant="danger"
        icon={
          toggleDialog.model?.isActive ? (
            <PowerOff className="h-5 w-5" />
          ) : (
            <Power className="h-5 w-5" />
          )
        }
      />

      {/* Detail Modal */}
      <ModelDetailModal
        open={detailModal.open}
        modelId={detailModal.modelId}
        onClose={() => setDetailModal({ open: false, modelId: null })}
        onSaved={() => {
          fetchModels(meta.page);
          fetchStats();
        }}
      />
    </div>
  );
}
