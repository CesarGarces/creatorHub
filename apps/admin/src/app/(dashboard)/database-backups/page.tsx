"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Database,
  Download,
  Trash2,
  Plus,
  Clock,
  HardDrive,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { ActionConfirmDialog } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";

interface Backup {
  id: string;
  filename: string;
  key: string;
  size: number;
  createdAt: string;
  database: string;
  environment: "development" | "production";
  status: "completed" | "failed" | "in-progress";
  error?: string;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB"];

export default function DatabaseBackupsPage() {
  const {
    t,
    tOptional,
    formatNumber,
    formatDate: formatLocaleDate,
  } = useI18n();

  // Units are universal; the number uses the locale's decimal separator.
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${formatNumber(bytes / Math.pow(k, i), { maximumFractionDigits: 1 })} ${BYTE_UNITS[i]}`;
  };

  const formatDate = (dateStr: string): string =>
    formatLocaleDate(dateStr, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const queryClient = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    backup: Backup | null;
  }>({ isOpen: false, backup: null });
  const [createDialog, setCreateDialog] = useState(false);

  const { data: backups, isLoading } = useQuery({
    queryKey: ["admin-backups"],
    queryFn: async () => {
      const res = await api.get<Backup[]>("/admin/backups");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/admin/backups"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      toast.success(t("backups.toasts.created"));
    },
    onError: (error: unknown) => {
      toast.error(localizeError(error, "backups.toasts.createFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/backups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      toast.success(t("backups.toasts.deleted"));
    },
    onError: (error: unknown) => {
      toast.error(localizeError(error, "backups.toasts.deleteFailed"));
    },
  });

  const handleDownload = async (backup: Backup) => {
    try {
      const res = await api.get<{ url: string }>(
        `/admin/backups/${backup.id}/download`,
      );
      window.open(res.data.url, "_blank");
    } catch {
      toast.error(t("backups.toasts.downloadFailed"));
    }
  };

  const completedBackups =
    backups?.filter((b) => b.status === "completed") || [];
  const totalSize = completedBackups.reduce((acc, b) => acc + b.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-text">
            {t("backups.title")}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {t("backups.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateDialog(true)}
          disabled={createMutation.isPending}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 sm:min-h-0"
        >
          {createMutation.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Plus size={18} />
          )}
          {t("backups.create")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Database size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-muted">
                {t("backups.stats.total")}
              </p>
              <p className="text-xl font-bold text-text">
                {completedBackups.length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <HardDrive size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-muted">
                {t("backups.stats.size")}
              </p>
              <p className="text-xl font-bold text-text">
                {formatBytes(totalSize)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Clock size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-muted">
                {t("backups.stats.last")}
              </p>
              <p className="text-xl font-bold text-text">
                {completedBackups[0]
                  ? formatDate(completedBackups[0].createdAt)
                  : t("backups.stats.never")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Backups Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-border bg-surface animate-pulse"
            />
          ))}
        </div>
      ) : backups && backups.length > 0 ? (
        <div className="@container rounded-xl border border-border bg-surface overflow-hidden">
          <table className="table-stack w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  {t("backups.table.filename")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  {t("backups.table.size")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  {t("backups.table.created")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  {t("backups.table.database")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  {t("backups.table.environment")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  {t("backups.table.status")}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-muted">
                  {t("backups.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr
                  key={backup.id}
                  className="border-b border-border last:border-0 hover:bg-surface-elevated transition-colors"
                >
                  <td className="px-4 py-3" data-primary>
                    <div className="flex items-center gap-2">
                      <Database size={14} className="shrink-0 text-text-dim" />
                      <span className="min-w-0 break-all text-sm font-medium text-text">
                        {backup.filename}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-text-muted"
                    data-label={t("backups.table.size")}
                  >
                    {formatBytes(backup.size)}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-text-muted"
                    data-label={t("backups.table.created")}
                  >
                    {formatDate(backup.createdAt)}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-text-muted"
                    data-label={t("backups.table.database")}
                  >
                    {backup.database}
                  </td>
                  <td
                    className="px-4 py-3"
                    data-label={t("backups.table.environment")}
                  >
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                        backup.environment === "production"
                          ? "bg-purple-500/10 text-purple-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}
                    >
                      {tOptional(
                        `backups.environments.${backup.environment}`,
                        backup.environment,
                      )}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3"
                    data-label={t("backups.table.status")}
                  >
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                        backup.status === "completed"
                          ? "bg-green-500/10 text-green-500"
                          : backup.status === "failed"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-yellow-500/10 text-yellow-500"
                      }`}
                    >
                      {backup.status === "completed" && (
                        <CheckCircle2 size={12} />
                      )}
                      {backup.status === "failed" && <XCircle size={12} />}
                      {backup.status === "in-progress" && (
                        <Loader2 size={12} className="animate-spin" />
                      )}
                      {tOptional(
                        `backups.statuses.${backup.status}`,
                        backup.status,
                      )}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3"
                    data-label={t("backups.table.actions")}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {backup.status === "completed" && (
                        <button
                          type="button"
                          onClick={() => handleDownload(backup)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 pointer-coarse:min-h-11 text-xs font-medium text-text-muted hover:bg-surface-elevated transition-colors"
                        >
                          <Download size={12} />
                          {t("backups.download")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteDialog({ isOpen: true, backup })
                        }
                        aria-label={t("backups.deleteAria", {
                          name: backup.filename,
                        })}
                        title={t("backups.deleteAria", {
                          name: backup.filename,
                        })}
                        className="flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-8 sm:p-12 text-center">
          <Database size={48} className="mx-auto text-text-dim mb-4" />
          <h3 className="text-lg font-medium text-text">
            {t("backups.emptyTitle")}
          </h3>
          <p className="text-sm text-text-muted mt-1">
            {t("backups.emptyDescription")}
          </p>
        </div>
      )}

      {/* Create Confirmation */}
      <ActionConfirmDialog
        isOpen={createDialog}
        onClose={() => setCreateDialog(false)}
        onConfirm={() => {
          createMutation.mutate();
          setCreateDialog(false);
        }}
        title={t("backups.createDialog.title")}
        description={t("backups.createDialog.description")}
        confirmLabel={t("backups.createDialog.confirm")}
        cancelLabel={t("common.cancel")}
        confirmVariant="primary"
        icon={<Database className="h-5 w-5" />}
      />

      {/* Delete Confirmation */}
      <ActionConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, backup: null })}
        onConfirm={() => {
          if (deleteDialog.backup) {
            deleteMutation.mutate(deleteDialog.backup.id);
          }
          setDeleteDialog({ isOpen: false, backup: null });
        }}
        title={t("backups.deleteDialog.title")}
        description={t("backups.deleteDialog.description", {
          name: deleteDialog.backup?.filename ?? "",
        })}
        confirmLabel={t("backups.deleteDialog.confirm")}
        cancelLabel={t("backups.deleteDialog.cancel")}
        confirmVariant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />
    </div>
  );
}
