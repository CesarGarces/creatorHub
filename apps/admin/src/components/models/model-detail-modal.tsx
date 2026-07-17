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

interface ModelDetailModalProps {
  open: boolean;
  onClose: () => void;
  modelId: string | null;
  onSaved: () => void;
}

const TASK_TYPES = [
  { value: "image-generation", label: "Image Generation" },
  { value: "text-generation", label: "Text Generation" },
  { value: "video-generation", label: "Video Generation" },
];

const taskTypeColor: Record<string, string> = {
  "image-generation": "bg-purple-100 text-purple-700",
  "text-generation": "bg-blue-100 text-blue-700",
  "video-generation": "bg-orange-100 text-orange-700",
};

export function ModelDetailModal({
  open,
  onClose,
  modelId,
  onSaved,
}: ModelDetailModalProps) {
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
        toast.error("Failed to load model details");
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
      toast.success("Model configuration updated");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to update model");
    } finally {
      setSaving(false);
    }
  };

  const tierVariant = model?.tier === "PRO" ? "premium" : "free";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Model Configuration</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : model ? (
          <div className="space-y-5 px-6 py-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-text">
                  {model.displayName}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-text-dim">
                  {model.modelId}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Badge variant={tierVariant} size="sm">
                  {model.tier}
                </Badge>
                <Badge
                  variant="outline"
                  size="sm"
                  className={taskTypeColor[model.taskType] ?? ""}
                >
                  {model.taskType}
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
                <label className="text-sm font-medium text-text">Active</label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">Tier</label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as "FREE" | "PRO")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  Task Type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary"
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  Credit Cost
                </label>
                <Input
                  type="number"
                  min={1}
                  value={creditCost}
                  onChange={(e) => setCreditCost(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  Profit Margin (×)
                </label>
                <Input
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
                Pricing
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {model.promptPricePer1k != null && (
                  <div>
                    <span className="text-text-dim">Prompt:</span>{" "}
                    <span className="font-mono text-text">
                      ${model.promptPricePer1k.toFixed(5)}/1k
                    </span>
                  </div>
                )}
                {model.completionPricePer1k != null && (
                  <div>
                    <span className="text-text-dim">Completion:</span>{" "}
                    <span className="font-mono text-text">
                      ${model.completionPricePer1k.toFixed(5)}/1k
                    </span>
                  </div>
                )}
                {model.imagePricePerGen != null && (
                  <div>
                    <span className="text-text-dim">Image gen:</span>{" "}
                    <span className="font-mono text-text">
                      ${model.imagePricePerGen.toFixed(4)}/gen
                    </span>
                  </div>
                )}
                {model.contextLength != null && (
                  <div>
                    <span className="text-text-dim">Context:</span>{" "}
                    <span className="font-mono text-text">
                      {model.contextLength.toLocaleString()} tokens
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
                <span className="text-text-muted">Streaming</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${model.supportsVision ? "bg-emerald-500" : "bg-gray-300"}`}
                />
                <span className="text-text-muted">Vision</span>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
