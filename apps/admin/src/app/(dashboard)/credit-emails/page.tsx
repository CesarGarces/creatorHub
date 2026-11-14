"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, Mail, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { ActionConfirmDialog, Badge, Skeleton, Switch } from "@creator-hub/ui";
import { CREDIT_STATES, type CreditState } from "@creator-hub/shared-types";
import api from "@/lib/api";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";
import { CreditEmailEditor } from "@/components/credit-emails/credit-email-editor";
import {
  apiErrorMessage,
  useCreditStateLabel,
  type CreditEmailInput,
  type CreditEmailLog,
  type CreditEmailTrigger,
} from "@/components/credit-emails/types";

/** Empty optional fields are sent as null. */
function toPayload(data: CreditEmailInput) {
  return {
    ...data,
    ctaLabel: data.ctaLabel || null,
    ctaUrl: data.ctaUrl || null,
  };
}

const STATUS_BADGE: Record<
  CreditEmailLog["status"],
  { labelKey: TranslationKey; variant: "secondary" | "error" | "warning" }
> = {
  SENT: { labelKey: "creditEmails.statuses.SENT", variant: "secondary" },
  FAILED: { labelKey: "creditEmails.statuses.FAILED", variant: "error" },
  PENDING: { labelKey: "creditEmails.statuses.PENDING", variant: "warning" },
};

export default function CreditEmailsPage() {
  const { t } = useI18n();
  const stateLabel = useCreditStateLabel();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{
    state: CreditState;
    trigger: CreditEmailTrigger | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<CreditEmailTrigger | null>(null);

  const { data: triggers, isLoading } = useQuery({
    queryKey: ["credit-email-triggers"],
    queryFn: async () =>
      (await api.get<CreditEmailTrigger[]>("/admin/credit-email-triggers"))
        .data,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["credit-email-logs"],
    queryFn: async () =>
      (await api.get<CreditEmailLog[]>("/admin/credit-email-logs?limit=50"))
        .data,
    refetchInterval: 30_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["credit-email-triggers"] });

  const createMutation = useMutation({
    mutationFn: (data: { state: CreditState } & CreditEmailInput) =>
      api.post("/admin/credit-email-triggers", toPayload(data)),
    onSuccess: () => {
      invalidate();
      toast.success(t("creditEmails.toasts.created"));
      setEditing(null);
    },
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t("creditEmails.toasts.createFailed")),
      ),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ReturnType<typeof toPayload>>;
    }) => api.put(`/admin/credit-email-triggers/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast.success(t("creditEmails.toasts.updated"));
      setEditing(null);
    },
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t("creditEmails.toasts.updateFailed")),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/admin/credit-email-triggers/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success(t("creditEmails.toasts.deleted"));
    },
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t("creditEmails.toasts.deleteFailed")),
      ),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) =>
      (
        await api.post<CreditEmailLog>(
          `/admin/credit-email-triggers/${id}/test`,
        )
      ).data,
    onSuccess: (log) => {
      queryClient.invalidateQueries({ queryKey: ["credit-email-logs"] });
      if (log.status === "SENT")
        toast.success(t("creditEmails.toasts.testSent", { email: log.email }));
      else
        toast.error(
          t("creditEmails.toasts.testFailed", {
            error: log.error ?? t("creditEmails.toasts.testFailedGeneric"),
          }),
        );
    },
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t("creditEmails.toasts.testFailedGeneric")),
      ),
  });

  const triggerFor = (state: CreditState) =>
    triggers?.find((t) => t.state === state) ?? null;

  const handleSave = (data: CreditEmailInput) => {
    if (!editing) return;
    if (editing.trigger) {
      updateMutation.mutate({ id: editing.trigger.id, data: toPayload(data) });
    } else {
      createMutation.mutate({ state: editing.state, ...data });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">
          {t("creditEmails.title")}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("creditEmails.subtitle")}
        </p>
      </div>

      <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-text-muted">
        <Info size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p>{t("creditEmails.infoOnce")}</p>
          <p>{t("creditEmails.infoSkip")}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">
                {t("creditEmails.columns.whenCreditsReach")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("creditEmails.columns.email")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("creditEmails.columns.active")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("creditEmails.columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? CREDIT_STATES.map((state) => (
                  <tr key={state}>
                    <td colSpan={4} className="px-4 py-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              : CREDIT_STATES.map((state) => {
                  const trigger = triggerFor(state);
                  return (
                    <tr key={state} className="hover:bg-surface-elevated/30">
                      <td className="px-4 py-3">
                        <span className="font-semibold tabular-nums text-text">
                          {stateLabel(state)}
                        </span>
                        <p className="font-mono text-xs text-text-dim">
                          {state}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {trigger ? (
                          <span className="text-text">{trigger.subject}</span>
                        ) : (
                          <span className="text-text-dim">
                            {t("creditEmails.noEmail")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {trigger && (
                          <Switch
                            checked={trigger.isActive}
                            aria-label={t("creditEmails.toggleAria", {
                              state: stateLabel(state),
                            })}
                            onCheckedChange={(checked: boolean) =>
                              updateMutation.mutate({
                                id: trigger.id,
                                data: { isActive: checked },
                              })
                            }
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {trigger ? (
                            <>
                              <button
                                type="button"
                                onClick={() => testMutation.mutate(trigger.id)}
                                disabled={testMutation.isPending}
                                title={t("creditEmails.testTitle")}
                                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-elevated disabled:opacity-50"
                              >
                                <Send size={14} />
                                {t("creditEmails.test")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing({ state, trigger })}
                                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-elevated"
                              >
                                <Pencil size={14} />
                                {t("common.edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleting(trigger)}
                                aria-label={t("creditEmails.deleteAria", {
                                  state: stateLabel(state),
                                })}
                                className="flex items-center rounded-lg border border-border px-2.5 py-1.5 text-red-500 transition-colors hover:bg-red-500/10"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setEditing({ state, trigger: null })
                              }
                              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                            >
                              <Plus size={14} />
                              {t("creditEmails.createEmail")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-text">
          {t("creditEmails.recent.title")}
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">
                  {t("creditEmails.recent.date")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("creditEmails.recent.user")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("creditEmails.recent.creditLevel")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("creditEmails.recent.subject")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("creditEmails.recent.status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logsLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ) : !logs?.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-text-dim"
                  >
                    <Mail className="mx-auto mb-2 h-5 w-5" />
                    {t("creditEmails.recent.empty")}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-elevated/30">
                    <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-text">{log.email}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {stateLabel(log.state)}
                      <span className="ml-1 text-xs text-text-dim">
                        {t("creditEmails.recent.creditsLeft", {
                          credits: log.credits,
                        })}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-text-muted">
                      {log.subject}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-1.5"
                        title={log.error ?? undefined}
                      >
                        <Badge
                          variant={STATUS_BADGE[log.status].variant}
                          size="sm"
                        >
                          {t(STATUS_BADGE[log.status].labelKey)}
                        </Badge>
                        {log.isTest && (
                          <Badge variant="outline" size="sm">
                            {t("creditEmails.recent.test")}
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-text">
              {t(
                editing.trigger
                  ? "creditEmails.modal.editTitle"
                  : "creditEmails.modal.createTitle",
                { state: stateLabel(editing.state) },
              )}
            </h2>
            <CreditEmailEditor
              state={editing.state}
              trigger={editing.trigger}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              isSaving={createMutation.isPending || updateMutation.isPending}
            />
          </div>
        </div>
      )}

      <ActionConfirmDialog
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
          setDeleting(null);
        }}
        title={t("creditEmails.deleteDialog.title")}
        description={
          deleting
            ? t("creditEmails.deleteDialog.description", {
                state: stateLabel(deleting.state),
              })
            : undefined
        }
        confirmLabel={t("creditEmails.deleteDialog.confirm")}
        cancelLabel={t("creditEmails.deleteDialog.cancel")}
        confirmVariant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />
    </div>
  );
}
