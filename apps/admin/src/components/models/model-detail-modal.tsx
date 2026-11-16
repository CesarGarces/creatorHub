"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Badge,
  Input,
  Switch,
} from "@creator-hub/ui";
import type { ModelMetadata } from "@/types";
import { useI18n } from "@/i18n/i18n-provider";
import { MODEL_TASK_TYPES } from "@/lib/model-form";

interface ModelDetailModalProps {
  open: boolean;
  onClose: () => void;
  modelId: string | null;
  onSaved: () => void;
}

const TASK_TYPES = MODEL_TASK_TYPES;

const taskTypeColor: Record<string, string> = {
  "image-generation": "bg-purple-100 text-purple-700",
  "text-generation": "bg-blue-100 text-blue-700",
  "video-generation": "bg-orange-100 text-orange-700",
  embedding: "bg-teal-100 text-teal-700",
  "speech-to-text": "bg-pink-100 text-pink-700",
};

export function ModelDetailModal({
  open,
  onClose,
  modelId,
  onSaved,
}: ModelDetailModalProps) {
  const { t, tOptional, formatNumber } = useI18n();
  const formatUsd = (value: number, digits: number) =>
    formatNumber(value, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const [model, setModel] = useState<ModelMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creditCost, setCreditCost] = useState(0);
  const [profitMargin, setProfitMargin] = useState(2.0);
  const [isActive, setIsActive] = useState(true);
  const [tier, setTier] = useState<"FREE" | "PRO">("FREE");
  const [taskType, setTaskType] = useState("text-generation");

  useEffect(() => {
    if (!open || !modelId) {
      setModel(null);
      return;
    }

    setLoading(true);
    api
      .get<ModelMetadata>(`/admin/models/${modelId}`)
      .then((res) => {
        setModel(res.data);
        setCreditCost(res.data.creditCost);
        setProfitMargin(res.data.profitMargin);
        setIsActive(res.data.isActive);
        setTier(res.data.tier);
        setTaskType(res.data.taskType);
      })
      .catch(() => {
        toast.error(t("models.detail.loadFailed"));
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, modelId]);

  const handleSave = async () => {
    if (!modelId) return;
    setSaving(true);
    try {
      await api.put(`/admin/models/${modelId}/config`, {
        isActive,
        creditCost,
        profitMargin,
        tier,
        taskType,
      });
      toast.success(t("models.detail.updated"));
      onSaved();
      onClose();
    } catch {
      toast.error(t("models.detail.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const tierVariant = model?.tier === "PRO" ? "premium" : "free";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" onClose={onClose}>
        <DialogHeader>
          <DialogTitle>{t("models.detail.title")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : model ? (
          <div className="space-y-5 px-5 py-4 sm:px-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-text">
                  {model.displayName}
                </h3>
                <p className="mt-0.5 break-all font-mono text-xs text-text-dim">
                  {model.modelId}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Badge variant={tierVariant} size="sm">
                  {tOptional(`models.tiers.${model.tier}`, model.tier)}
                </Badge>
                <Badge
                  variant="outline"
                  size="sm"
                  className={taskTypeColor[model.taskType] ?? ""}
                >
                  {tOptional(
                    `models.detail.taskTypes.${model.taskType}`,
                    model.taskType,
                  )}
                </Badge>
              </div>
            </div>

            {model.description && (
              <p className="text-sm text-text-muted">{model.description}</p>
            )}

            {/* Tags */}
            {model.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {model.tags.map((tag) => (
                  <Badge key={tag} variant="outline" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Config */}
            <div className="space-y-4 rounded-lg border border-border bg-surface-elevated/30 p-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text">
                  {t("models.detail.active")}
                </label>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  aria-label={t("models.detail.active")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  {t("models.detail.tier")}
                </label>
                <select
                  value={tier}
                  aria-label={t("models.detail.tier")}
                  onChange={(e) => setTier(e.target.value as "FREE" | "PRO")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="FREE">{t("models.tiers.FREE")}</option>
                  <option value="PRO">{t("models.tiers.PRO")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  {t("models.detail.taskType")}
                </label>
                <select
                  value={taskType}
                  aria-label={t("models.detail.taskType")}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
                >
                  {TASK_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`models.detail.taskTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  {t("models.detail.creditCost")}
                </label>
                <Input
                  aria-label={t("models.detail.creditCost")}
                  type="number"
                  min={0}
                  value={creditCost}
                  onChange={(e) => setCreditCost(Number(e.target.value))}
                  className="w-full"
                  aria-describedby="model-detail-cost-hint"
                />
                <p
                  id="model-detail-cost-hint"
                  className="text-xs text-text-muted"
                >
                  {t("models.detail.creditCostHint")}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  {t("models.detail.profitMargin")}
                </label>
                <Input
                  aria-label={t("models.detail.profitMargin")}
                  type="number"
                  min={1}
                  step={0.1}
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-dim">
                {t("models.detail.pricing")}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {model.promptPricePer1k != null && (
                  <div>
                    <span className="text-text-dim">
                      {t("models.detail.prompt")}
                    </span>{" "}
                    <span className="font-mono text-text">
                      {t("models.detail.perThousand", {
                        price: formatUsd(model.promptPricePer1k, 5),
                      })}
                    </span>
                  </div>
                )}
                {model.completionPricePer1k != null && (
                  <div>
                    <span className="text-text-dim">
                      {t("models.detail.completion")}
                    </span>{" "}
                    <span className="font-mono text-text">
                      {t("models.detail.perThousand", {
                        price: formatUsd(model.completionPricePer1k, 5),
                      })}
                    </span>
                  </div>
                )}
                {model.imagePricePerGen != null && (
                  <div>
                    <span className="text-text-dim">
                      {t("models.detail.imageGen")}
                    </span>{" "}
                    <span className="font-mono text-text">
                      {t("models.detail.perGeneration", {
                        price: formatUsd(model.imagePricePerGen, 4),
                      })}
                    </span>
                  </div>
                )}
                {model.contextLength != null && (
                  <div>
                    <span className="text-text-dim">
                      {t("models.detail.context")}
                    </span>{" "}
                    <span className="font-mono text-text">
                      {t("models.detail.tokens", {
                        count: model.contextLength,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Capabilities */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${model.supportsStreaming ? "bg-emerald-500" : "bg-gray-300"}`}
                />
                <span className="text-text-muted">
                  {t("models.detail.streaming")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${model.supportsVision ? "bg-emerald-500" : "bg-gray-300"}`}
                />
                <span className="text-text-muted">
                  {t("models.detail.vision")}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("common.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
