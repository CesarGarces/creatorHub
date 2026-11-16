"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Switch,
  Textarea,
} from "@creator-hub/ui";
import type { ModelMetadata } from "@/types";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import {
  MODEL_PROVIDERS,
  MODEL_TASK_TYPES,
  PROVIDERS_BY_TASK,
  MAX_CREDIT_COST,
  emptyModelForm,
  hasErrors,
  toCreateModelPayload,
  validateModelForm,
  withTaskType,
  type ModelFormErrors,
  type ModelFormField,
  type ModelFormValues,
  type ModelProviderSlug,
  type ModelTaskType,
} from "@/lib/model-form";

interface CreateModelModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (model: ModelMetadata) => void;
}

const SELECT_CLASS =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary";

/** Admin → AI Models → "Add model". */
export function CreateModelModal({
  open,
  onClose,
  onCreated,
}: CreateModelModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<ModelFormValues>(() => emptyModelForm());
  const [errors, setErrors] = useState<ModelFormErrors>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setForm(emptyModelForm());
    setErrors({});
    setServerError("");
    onClose();
  };

  const update = <K extends keyof ModelFormValues>(
    key: K,
    value: ModelFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as ModelFormField];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateModelForm(form);
    setErrors(found);
    setServerError("");
    if (hasErrors(found)) return;
    setSaving(true);
    try {
      const res = await api.post<ModelMetadata>(
        "/admin/models",
        toCreateModelPayload(form),
      );
      toast.success(t("models.create.created", { name: res.data.displayName }));
      setForm(emptyModelForm());
      setErrors({});
      onCreated(res.data);
      onClose();
    } catch (err) {
      setServerError(localizeError(err, "models.create.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (field: ModelFormField) => {
    const code = errors[field];
    if (!code) return null;
    return (
      <p id={`model-${field}-error`} className="text-xs text-error">
        {t(`models.create.errors.${code}`)}
      </p>
    );
  };
  const describedBy = (field: ModelFormField, hint?: string) =>
    [errors[field] ? `model-${field}-error` : null, hint]
      .filter(Boolean)
      .join(" ") || undefined;

  const providers = PROVIDERS_BY_TASK[form.taskType];
  const isText = form.taskType === "text-generation";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent
        className="flex max-h-[90vh] w-full max-w-xl flex-col"
        onClose={close}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-model-title"
      >
        <DialogHeader>
          <DialogTitle id="create-model-title">
            {t("models.create.title")}
          </DialogTitle>
          <DialogDescription>{t("models.create.subtitle")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {serverError && (
              <div
                role="alert"
                className="rounded-lg bg-error/10 p-3 text-sm text-error"
              >
                {serverError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="model-taskType"
                  className="text-sm font-medium text-text"
                >
                  {t("models.create.taskType")}
                </label>
                <select
                  id="model-taskType"
                  value={form.taskType}
                  onChange={(e) =>
                    setForm((prev) =>
                      withTaskType(prev, e.target.value as ModelTaskType),
                    )
                  }
                  className={SELECT_CLASS}
                  aria-describedby="model-taskType-hint"
                >
                  {MODEL_TASK_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`models.detail.taskTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="model-provider"
                  className="text-sm font-medium text-text"
                >
                  {t("models.create.provider")}
                </label>
                <select
                  id="model-provider"
                  value={form.providerSlug}
                  onChange={(e) =>
                    update("providerSlug", e.target.value as ModelProviderSlug)
                  }
                  className={SELECT_CLASS}
                >
                  {MODEL_PROVIDERS.filter((p) =>
                    providers.includes(p.value),
                  ).map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p id="model-taskType-hint" className="text-xs text-text-muted">
              {t(`models.create.taskHints.${form.taskType}`)}
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="model-modelId"
                className="text-sm font-medium text-text"
              >
                {t("models.create.modelId")}
              </label>
              <Input
                id="model-modelId"
                value={form.modelId}
                onChange={(e) => update("modelId", e.target.value)}
                placeholder={t("models.create.modelIdPlaceholder")}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.modelId)}
                aria-describedby={describedBy("modelId", "model-modelId-hint")}
              />
              <p id="model-modelId-hint" className="text-xs text-text-dim">
                {t("models.create.modelIdHint")}
              </p>
              {fieldError("modelId")}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="model-displayName"
                className="text-sm font-medium text-text"
              >
                {t("models.create.displayName")}
              </label>
              <Input
                id="model-displayName"
                value={form.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                placeholder={t("models.create.displayNamePlaceholder")}
                aria-invalid={Boolean(errors.displayName)}
                aria-describedby={describedBy("displayName")}
              />
              {fieldError("displayName")}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="model-tier"
                  className="text-sm font-medium text-text"
                >
                  {t("models.create.tier")}
                </label>
                <select
                  id="model-tier"
                  value={form.tier}
                  onChange={(e) =>
                    update("tier", e.target.value as "FREE" | "PRO")
                  }
                  className={SELECT_CLASS}
                >
                  <option value="FREE">{t("models.tiers.FREE")}</option>
                  <option value="PRO">{t("models.tiers.PRO")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="model-creditCost"
                  className="text-sm font-medium text-text"
                >
                  {t("models.create.creditCost")}
                </label>
                <Input
                  id="model-creditCost"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_CREDIT_COST}
                  step={1}
                  value={form.creditCost}
                  onChange={(e) => update("creditCost", e.target.value)}
                  aria-invalid={Boolean(errors.creditCost)}
                  aria-describedby={describedBy(
                    "creditCost",
                    "model-creditCost-hint",
                  )}
                />
                {fieldError("creditCost")}
              </div>
            </div>
            <p id="model-creditCost-hint" className="text-xs text-text-muted">
              {t("models.detail.creditCostHint")}
            </p>

            {isText && (
              <div className="space-y-1.5">
                <label
                  htmlFor="model-contextLength"
                  className="text-sm font-medium text-text"
                >
                  {t("models.create.contextLength")}
                </label>
                <Input
                  id="model-contextLength"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={form.contextLength}
                  onChange={(e) => update("contextLength", e.target.value)}
                  aria-invalid={Boolean(errors.contextLength)}
                  aria-describedby={describedBy("contextLength")}
                />
                {fieldError("contextLength")}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="model-description"
                className="text-sm font-medium text-text"
              >
                {t("models.create.description")}
              </label>
              <Textarea
                id="model-description"
                rows={2}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={describedBy("description")}
              />
              {fieldError("description")}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="model-tags"
                className="text-sm font-medium text-text"
              >
                {t("models.create.tags")}
              </label>
              <Input
                id="model-tags"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder={t("models.create.tagsPlaceholder")}
                aria-invalid={Boolean(errors.tags)}
                aria-describedby={describedBy("tags", "model-tags-hint")}
              />
              <p id="model-tags-hint" className="text-xs text-text-dim">
                {t("models.create.tagsHint")}
              </p>
              {fieldError("tags")}
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-surface-elevated/30 p-4">
              {isText && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">
                      {t("models.create.streaming")}
                    </span>
                    <Switch
                      checked={form.supportsStreaming}
                      onCheckedChange={(v) => update("supportsStreaming", v)}
                      aria-label={t("models.create.streaming")}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">
                      {t("models.create.vision")}
                    </span>
                    <Switch
                      checked={form.supportsVision}
                      onCheckedChange={(v) => update("supportsVision", v)}
                      aria-label={t("models.create.vision")}
                    />
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">
                  {t("models.create.activate")}
                </span>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => update("isActive", v)}
                  aria-label={t("models.create.activate")}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {t("models.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
