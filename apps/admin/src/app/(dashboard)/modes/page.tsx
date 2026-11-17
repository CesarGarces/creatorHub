"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Layers, Cpu, Wrench } from "lucide-react";
import { ActionConfirmDialog, Switch } from "@creator-hub/ui";
import type { Mode } from "@/types";
import { ModalShell } from "@/components/modal-shell";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";

export default function ModesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [editingMode, setEditingMode] = useState<Mode | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    mode: Mode | null;
  }>({ isOpen: false, mode: null });

  const { data: modes, isLoading } = useQuery({
    queryKey: ["modes"],
    queryFn: async () => {
      const res = await api.get<Mode[]>("/admin/modes");
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Mode> }) =>
      api.put(`/admin/modes/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modes"] });
      toast.success(t("modes.toasts.updated"));
      setEditingMode(null);
    },
    onError: (error: unknown) => {
      toast.error(localizeError(error, "modes.toasts.updateFailed"));
    },
  });

  const createMutation = useMutation({
    mutationFn: (
      data: Omit<Mode, "id" | "createdAt" | "updatedAt" | "_count">,
    ) => api.post("/admin/modes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modes"] });
      toast.success(t("modes.toasts.created"));
      setIsCreateMode(false);
    },
    onError: (error: unknown) => {
      toast.error(localizeError(error, "modes.toasts.createFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/modes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modes"] });
      toast.success(t("modes.toasts.deleted"));
    },
    onError: (error: unknown) => {
      toast.error(localizeError(error, "modes.toasts.deleteFailed"));
    },
  });

  const handleSave = (formData: Partial<Mode>) => {
    if (editingMode) {
      updateMutation.mutate({ id: editingMode.id, updates: formData });
    } else if (isCreateMode) {
      createMutation.mutate(formData as any);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text">
            {t("modes.title")}
          </h1>
          <p className="text-sm text-text-muted mt-1">{t("modes.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingMode(null);
            setIsCreateMode(true);
          }}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors sm:min-h-0"
        >
          <Plus size={18} />
          {t("modes.add")}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface p-6 animate-pulse"
            >
              <div className="h-5 bg-surface-elevated rounded w-1/2 mb-4" />
              <div className="h-4 bg-surface-elevated rounded w-3/4 mb-2" />
              <div className="h-4 bg-surface-elevated rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modes?.map((mode) => (
            <div
              key={mode.id}
              className="rounded-xl border border-border bg-surface p-4 sm:p-6 flex flex-col relative"
            >
              <div className="absolute top-4 right-4 flex gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    mode.isActive
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {mode.isActive ? t("common.active") : t("common.inactive")}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3 pr-20">
                {mode.icon ? (
                  <span className="text-2xl">{mode.icon}</span>
                ) : (
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: mode.color || "#6366f1" }}
                  >
                    <Layers size={20} className="text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-text">
                    {mode.name}
                  </h3>
                  <p className="text-xs text-text-dim font-mono">{mode.slug}</p>
                </div>
              </div>

              {mode.description && (
                <p className="text-sm text-text-muted mb-4">
                  {mode.description}
                </p>
              )}

              <div className="flex gap-4 text-xs text-text-dim mb-4">
                <span className="flex items-center gap-1">
                  <Wrench size={12} />
                  {t("modes.tools", { count: mode._count?.tools || 0 })}
                </span>
                <span className="flex items-center gap-1">
                  <Cpu size={12} />
                  {t("modes.providers", { count: mode._count?.providers || 0 })}
                </span>
              </div>

              {mode.color && (
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: mode.color }}
                  />
                  <span className="text-xs text-text-dim font-mono">
                    {mode.color}
                  </span>
                </div>
              )}

              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMode(mode);
                    setIsCreateMode(false);
                  }}
                  className="flex-1 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-elevated transition-colors sm:min-h-0"
                >
                  <Pencil size={14} />
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteDialog({ isOpen: true, mode })}
                  aria-label={t("modes.deleteAria", { name: mode.name })}
                  title={t("modes.deleteAria", { name: mode.name })}
                  className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors sm:min-h-0 sm:min-w-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editingMode || isCreateMode) && (
        <ModalShell labelledBy="mode-form-title">
          <h2
            id="mode-form-title"
            className="text-lg font-semibold text-text mb-4"
          >
            {editingMode ? t("modes.editTitle") : t("modes.createTitle")}
          </h2>
          <ModeForm
            mode={editingMode}
            onSave={handleSave}
            onCancel={() => {
              setEditingMode(null);
              setIsCreateMode(false);
            }}
            isLoading={updateMutation.isPending || createMutation.isPending}
          />
        </ModalShell>
      )}

      <ActionConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, mode: null })}
        onConfirm={() => {
          if (deleteDialog.mode) {
            deleteMutation.mutate(deleteDialog.mode.id);
          }
          setDeleteDialog({ isOpen: false, mode: null });
        }}
        title={t("modes.deleteDialog.title")}
        description={t("modes.deleteDialog.description", {
          name: deleteDialog.mode?.name ?? "",
        })}
        confirmLabel={t("modes.deleteDialog.confirm")}
        cancelLabel={t("modes.deleteDialog.cancel")}
        confirmVariant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />
    </div>
  );
}

function ModeForm({
  mode,
  onSave,
  onCancel,
  isLoading,
}: {
  mode: Mode | null;
  onSave: (data: Partial<Mode>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useI18n();
  const [slug, setSlug] = useState(mode?.slug || "");
  const [name, setName] = useState(mode?.name || "");
  const [description, setDescription] = useState(mode?.description || "");
  const [icon, setIcon] = useState(mode?.icon || "");
  const [color, setColor] = useState(mode?.color || "#6366f1");
  const [isActive, setIsActive] = useState(mode?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      slug,
      name,
      description: description || undefined,
      icon: icon || undefined,
      color: color || undefined,
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="mode-slug"
          className="block text-sm font-medium text-text mb-1"
        >
          {t("modes.form.slug")}
        </label>
        <input
          id="mode-slug"
          type="text"
          value={slug}
          onChange={(e) =>
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          placeholder="image-generation"
          disabled={!!mode}
          required
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        {mode && (
          <p className="text-xs text-text-dim mt-1">
            {t("modes.form.slugLocked")}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="mode-name"
          className="block text-sm font-medium text-text mb-1"
        >
          {t("modes.form.name")}
        </label>
        <input
          id="mode-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("modes.form.namePlaceholder")}
          required
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div>
        <label
          htmlFor="mode-description"
          className="block text-sm font-medium text-text mb-1"
        >
          {t("modes.form.description")}
        </label>
        <input
          id="mode-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("modes.form.descriptionPlaceholder")}
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="mode-icon"
            className="block text-sm font-medium text-text mb-1"
          >
            {t("modes.form.icon")}
          </label>
          <input
            id="mode-icon"
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🎨"
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label
            htmlFor="mode-color"
            className="block text-sm font-medium text-text mb-1"
          >
            {t("modes.form.color")}
          </label>
          <div className="flex items-center gap-3">
            <input
              id="mode-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-10 rounded-lg border border-border cursor-pointer"
            />
            <span className="text-sm font-mono text-text-muted">{color}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          aria-label={t("modes.form.active")}
        />
        <span className="text-sm font-medium text-text">
          {t("modes.form.active")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 sm:flex sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-elevated transition-colors disabled:opacity-50 sm:min-h-0"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 sm:min-h-0"
        >
          {isLoading
            ? t("common.saving")
            : mode
              ? t("common.saveChanges")
              : t("modes.form.create")}
        </button>
      </div>
    </form>
  );
}
