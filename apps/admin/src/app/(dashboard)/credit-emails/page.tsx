"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, Mail, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { ActionConfirmDialog, Badge, Skeleton, Switch } from "@creator-hub/ui";
import { CREDIT_STATES, type CreditState } from "@creator-hub/shared-types";
import api from "@/lib/api";
import { CreditEmailEditor } from "@/components/credit-emails/credit-email-editor";
import {
  apiErrorMessage,
  creditStateLabel,
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
  { label: string; variant: "secondary" | "error" | "warning" }
> = {
  SENT: { label: "Sent", variant: "secondary" },
  FAILED: { label: "Failed", variant: "error" },
  PENDING: { label: "Sending", variant: "warning" },
};

export default function CreditEmailsPage() {
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
      toast.success("Email created");
      setEditing(null);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Failed to create email")),
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
      toast.success("Email updated");
      setEditing(null);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Failed to update email")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/admin/credit-email-triggers/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Email deleted");
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Failed to delete email")),
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
        toast.success(`Test email sent to ${log.email}`);
      else toast.error(`Test email failed: ${log.error ?? "unknown error"}`);
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, "Failed to send test email")),
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
        <h1 className="text-2xl font-bold text-text">Credit Emails</h1>
        <p className="mt-1 text-sm text-text-muted">
          Emails sent automatically when a user&apos;s credit balance drops to a
          credit level
        </p>
      </div>

      <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-text-muted">
        <Info size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p>
            Each email is sent <span className="text-text">once</span> when a
            user&apos;s balance reaches its level. The user gets it again only
            after they receive more credits (purchase, bonus, subscription).
          </p>
          <p>
            If one usage skips several levels (e.g. 60 → 0), only the email for
            the lowest level reached is sent.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">When credits reach</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
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
                          {creditStateLabel(state)}
                        </span>
                        <p className="font-mono text-xs text-text-dim">
                          {state}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {trigger ? (
                          <span className="text-text">{trigger.subject}</span>
                        ) : (
                          <span className="text-text-dim">No email</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {trigger && (
                          <Switch
                            checked={trigger.isActive}
                            aria-label={`Toggle email for ${creditStateLabel(state)}`}
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
                                title="Send a test to your admin email"
                                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-elevated disabled:opacity-50"
                              >
                                <Send size={14} />
                                Test
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing({ state, trigger })}
                                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-elevated"
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleting(trigger)}
                                aria-label={`Delete email for ${creditStateLabel(state)}`}
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
                              Create email
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
        <h2 className="mb-3 text-lg font-semibold text-text">Recent emails</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/50 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Credit level</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
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
                    No credit emails sent yet
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
                      {creditStateLabel(log.state)}
                      <span className="ml-1 text-xs text-text-dim">
                        ({log.credits} left)
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
                          {STATUS_BADGE[log.status].label}
                        </Badge>
                        {log.isTest && (
                          <Badge variant="outline" size="sm">
                            Test
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
              {editing.trigger ? "Edit" : "Create"} email —{" "}
              {creditStateLabel(editing.state)}
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
        title="Delete Credit Email"
        description={
          deleting
            ? `Users will no longer receive an email at ${creditStateLabel(deleting.state)}. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete email"
        cancelLabel="Keep email"
        confirmVariant="danger"
        icon={<Trash2 className="h-5 w-5" />}
      />
    </div>
  );
}
