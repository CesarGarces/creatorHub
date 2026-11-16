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
  Plus,
  Trash2,
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
import { CreateModelModal } from "@/components/models/create-model-modal";
import { MODEL_PROVIDERS, MODEL_TASK_TYPES } from "@/lib/model-form";
import type { ModelMetadata, ModelStats, PaginatedResponse } from "@/types";
import { useI18n, t as translateNow } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";

const TASK_TYPES = MODEL_TASK_TYPES;

const TIERS = ["FREE", "PRO"] as const;

// Provider names are brands and stay untranslated.
const PROVIDERS = MODEL_PROVIDERS;

export default function ModelsPage() {
  const {
    t,
    tOptional,
    formatNumber,
    formatDate: formatLocaleDate,
  } = useI18n();

  const formatDate = (dateStr: string): string =>
    dateStr
      ? formatLocaleDate(dateStr, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

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
  const [sort, setSort] = useState("");
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

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ModelMetadata | null>(null);

  // Confirmation dialog for toggling active/inactive
  const [toggleDialog, setToggleDialog] = useState<{
    isOpen: boolean;
    model: ModelMetadata | null;
  }>({ isOpen: false, model: null });

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
        if (sort) params.sort = sort;
        if (!showInactive) params.isActive = "true";

        const res = await api.get<PaginatedResponse<ModelMetadata>>(
          "/admin/models",
          { params },
        );
        setModels(res.data.data);
        setMeta(res.data.meta);
      } catch {
        // Non-hook `t`: keeps this callback independent of the language.
        toast.error(translateNow("models.toasts.loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, taskType, tier, providerSlug, sort, showInactive],
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
        t(
          isActive
            ? "models.toasts.bulkActivated"
            : "models.toasts.bulkDeactivated",
          { count: selected.size },
        ),
      );
      setSelected(new Set());
      fetchModels(meta.page);
      fetchStats();
    } catch {
      toast.error(t("models.toasts.bulkFailed"));
    }
  };

  // ──────────────────────────────────────────────
  // Sync
  // ──────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/admin/models/sync");
      toast.success(t("models.toasts.syncStarted"));
      setTimeout(() => {
        fetchModels(1);
        fetchStats();
      }, 2000);
    } catch {
      toast.error(t("models.toasts.syncFailed"));
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
        t(newActive ? "models.toasts.activated" : "models.toasts.deactivated", {
          name: model.displayName,
        }),
      );
      fetchStats();
    } catch {
      toast.error(t("models.toasts.updateFailed"));
    } finally {
      setToggleDialog({ isOpen: false, model: null });
    }
  };

  // ──────────────────────────────────────────────
  // Delete (models added by hand only)
  // ──────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    const model = deleteTarget;
    if (!model) return;
    try {
      await api.delete(`/admin/models/${model.id}`);
      toast.success(t("models.toasts.deleted", { name: model.displayName }));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(model.id);
        return next;
      });
      fetchModels(meta.page);
      fetchStats();
    } catch (err) {
      toast.error(localizeError(err, "models.toasts.deleteFailed"));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{t("models.title")}</h1>
          <p className="text-text-muted">{t("models.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("models.sync")}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("models.addModel")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-dim">
              {t("models.stats.total")}
            </p>
            <p className="text-2xl font-bold text-text">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-dim">
              {t("models.stats.active")}
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.active}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-dim">
              {t("models.stats.image")}
            </p>
            <p className="text-2xl font-bold text-purple-600">
              {stats.byTaskType["image-generation"] ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-dim">
              {t("models.stats.text")}
            </p>
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
            placeholder={t("models.filters.searchPlaceholder")}
            aria-label={t("models.filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
          aria-label={t("models.filters.typeAria")}
        >
          <option value="">{t("models.filters.allTypes")}</option>
          {TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`models.taskTypes.${type}`)}
            </option>
          ))}
        </select>

        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
          aria-label={t("models.filters.tierAria")}
        >
          <option value="">{t("models.filters.allTiers")}</option>
          {TIERS.map((value) => (
            <option key={value} value={value}>
              {t(`models.tiers.${value}`)}
            </option>
          ))}
        </select>

        <select
          value={providerSlug}
          onChange={(e) => setProviderSlug(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
          aria-label={t("models.filters.providerAria")}
        >
          <option value="">{t("models.filters.allProviders")}</option>
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
          aria-label={t("models.filters.sortAria")}
        >
          <option value="">{t("models.filters.defaultOrder")}</option>
          <option value="newest">{t("models.filters.newest")}</option>
        </select>

        <div className="flex items-center gap-2">
          <Switch
            checked={showInactive}
            onCheckedChange={setShowInactive}
            aria-label={t("models.filters.showInactive")}
          />
          <span className="text-sm text-text-muted">
            {t("models.filters.showInactive")}
          </span>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm text-text">
            {t("models.bulk.selected", { count: selected.size })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkAction(true)}
          >
            <Power className="mr-1.5 h-3.5 w-3.5" />
            {t("models.bulk.activate")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkAction(false)}
          >
            <PowerOff className="mr-1.5 h-3.5 w-3.5" />
            {t("models.bulk.deactivate")}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={models.length > 0 && selected.size === models.length}
                  onChange={toggleSelectAll}
                  aria-label={t("models.table.selectAll")}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
              </th>
              <th className="px-4 py-3 font-medium">
                {t("models.table.model")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("models.table.provider")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("models.table.type")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("models.table.tier")}
              </th>
              <th className="px-4 py-3 font-medium text-right">
                {t("models.table.credits")}
              </th>
              <th className="px-4 py-3 font-medium text-right">
                {t("models.table.margin")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("models.table.status")}
              </th>
              <th className="hidden px-4 py-3 font-medium 2xl:table-cell">
                {t("models.table.integrated")}
              </th>
              <th className="px-4 py-3 font-medium text-right">
                {t("models.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={10} className="px-4 py-4">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : models.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-text-dim"
                >
                  <BrainCircuit className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <p>{t("models.empty")}</p>
                  <p className="mt-1 text-xs">{t("models.emptyHint")}</p>
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
                      aria-label={t("models.table.select", {
                        name: model.displayName,
                      })}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-text">
                        {model.displayName}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <span className="max-w-[240px] truncate font-mono text-xs text-text-dim">
                          {model.modelId}
                        </span>
                        {model.isCustom && (
                          <span title={t("models.customHint")}>
                            <Badge variant="outline" size="sm">
                              {t("models.custom")}
                            </Badge>
                          </span>
                        )}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" size="sm">
                      {model.providerSlug}
                    </Badge>
                  </td>

                  {/* Task Type */}
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        model.taskType === "image-generation"
                          ? "primary"
                          : model.taskType === "text-generation"
                            ? "secondary"
                            : "accent"
                      }
                      size="sm"
                    >
                      {tOptional(
                        `models.taskTypes.${model.taskType}`,
                        model.taskType.replace("-generation", ""),
                      )}
                    </Badge>
                  </td>

                  {/* Tier */}
                  <td className="px-4 py-3">
                    <Badge
                      variant={model.tier === "PRO" ? "premium" : "free"}
                      size="sm"
                    >
                      {tOptional(`models.tiers.${model.tier}`, model.tier)}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-text">
                    {model.creditCost}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text">
                    {formatNumber(model.profitMargin)}×
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={model.isActive ? "secondary" : "outline"}
                      size="sm"
                    >
                      {model.isActive
                        ? t("common.active")
                        : t("common.inactive")}
                    </Badge>
                  </td>
                  <td
                    className="hidden whitespace-nowrap px-4 py-3 text-text-muted 2xl:table-cell"
                    title={
                      model.integratedAt
                        ? formatLocaleDate(model.integratedAt, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : undefined
                    }
                  >
                    {formatDate(model.integratedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Switch
                        checked={model.isActive}
                        onCheckedChange={() => handleToggleClick(model)}
                        aria-label={t("models.toggleAria", {
                          name: model.displayName,
                        })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDetailModal({ open: true, modelId: model.id })
                        }
                        aria-label={t("models.configureAria", {
                          name: model.displayName,
                        })}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      {model.isCustom && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(model)}
                          aria-label={t("models.deleteAria", {
                            name: model.displayName,
                          })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
            {t("models.pagination", {
              page: meta.page,
              total: meta.totalPages,
              count: meta.total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => fetchModels(meta.page - 1)}
            >
              {t("common.previous")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchModels(meta.page + 1)}
            >
              {t("common.next")}
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
          toggleDialog.model?.isActive
            ? t("models.toggle.deactivateTitle")
            : t("models.toggle.activateTitle")
        }
        description={t(
          toggleDialog.model?.isActive
            ? "models.toggle.deactivateDescription"
            : "models.toggle.activateDescription",
          { name: toggleDialog.model?.displayName ?? "" },
        )}
        confirmLabel={
          toggleDialog.model?.isActive
            ? t("models.toggle.deactivate")
            : t("models.toggle.activate")
        }
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
        icon={
          toggleDialog.model?.isActive ? (
            <PowerOff className="h-5 w-5" />
          ) : (
            <Power className="h-5 w-5" />
          )
        }
      />

      {/* Delete confirmation (custom models only) */}
      <ActionConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("models.remove.title")}
        description={t("models.remove.description", {
          name: deleteTarget?.displayName ?? "",
        })}
        confirmLabel={t("models.remove.confirm")}
        cancelLabel={t("common.cancel")}
        confirmVariant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />

      <CreateModelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          fetchModels(1);
          fetchStats();
        }}
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
