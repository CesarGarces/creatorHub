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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function DatabaseBackupsPage() {
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
      toast.success("Backup created successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create backup");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/backups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      toast.success("Backup deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete backup");
    },
  });

  const handleDownload = async (backup: Backup) => {
    try {
      const res = await api.get<{ url: string }>(
        `/admin/backups/${backup.id}/download`,
      );
      window.open(res.data.url, "_blank");
    } catch {
      toast.error("Failed to get download link");
    }
  };

  const completedBackups =
    backups?.filter((b) => b.status === "completed") || [];
  const totalSize = completedBackups.reduce((acc, b) => acc + b.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Database Backups</h1>
          <p className="text-sm text-text-muted mt-1">
            Create and manage PostgreSQL backups stored in R2
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateDialog(true)}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Plus size={18} />
          )}
          Create Backup
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Database size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Total Backups</p>
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
              <p className="text-sm text-text-muted">Total Size</p>
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
              <p className="text-sm text-text-muted">Last Backup</p>
              <p className="text-xl font-bold text-text">
                {completedBackups[0]
                  ? formatDate(completedBackups[0].createdAt)
                  : "Never"}
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
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  Filename
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  Database
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  Environment
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr
                  key={backup.id}
                  className="border-b border-border last:border-0 hover:bg-surface-elevated transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-text-dim" />
                      <span className="text-sm font-medium text-text">
                        {backup.filename}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatBytes(backup.size)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatDate(backup.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {backup.database}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                        backup.environment === "production"
                          ? "bg-purple-500/10 text-purple-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}
                    >
                      {backup.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3">
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
                      {backup.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {backup.status === "completed" && (
                        <button
                          type="button"
                          onClick={() => handleDownload(backup)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-elevated transition-colors"
                        >
                          <Download size={12} />
                          Download
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteDialog({ isOpen: true, backup })
                        }
                        className="flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
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
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <Database size={48} className="mx-auto text-text-dim mb-4" />
          <h3 className="text-lg font-medium text-text">No backups yet</h3>
          <p className="text-sm text-text-muted mt-1">
            Create your first backup to protect your data
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
        title="Create Backup"
        description="This will create a full PostgreSQL backup and store it in R2. The process may take a few minutes depending on database size."
        confirmLabel="Create backup"
        cancelLabel="Cancel"
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
        title="Delete Backup"
        description={`Are you sure you want to delete "${deleteDialog.backup?.filename}"? This action cannot be undone.`}
        confirmLabel="Delete backup"
        cancelLabel="Keep backup"
        confirmVariant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />
    </div>
  );
}
