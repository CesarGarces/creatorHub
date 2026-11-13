"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Skeleton,
  Switch,
  Textarea,
} from "@creator-hub/ui";
import { ProviderSelect } from "@/components/provider-select";
import { useCommunityBotStore } from "@/store/community-bot.store";
import { useI18n } from "@/i18n/i18n-provider";

interface Draft {
  isEnabled: boolean;
  modelId: string;
  temperature: number;
  maxTokens: number;
  systemPromptExtra: string;
  useStyleProfile: boolean;
  historyLength: number;
  dailyReplyLimit: number;
  perContactCooldownSec: number;
}

export function BehaviorTab() {
  const { t } = useI18n();
  const config = useCommunityBotStore((s) => s.config);
  const isLoading = useCommunityBotStore((s) => s.isLoadingConfig);
  const isSaving = useCommunityBotStore((s) => s.isSavingConfig);
  const updateConfig = useCommunityBotStore((s) => s.updateConfig);

  const [draft, setDraft] = useState<Draft | null>(null);

  // Initialize the local draft once the config arrives
  useEffect(() => {
    if (config && !draft) {
      setDraft({
        isEnabled: config.isEnabled,
        modelId: config.modelId,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        systemPromptExtra: config.systemPromptExtra ?? "",
        useStyleProfile: config.useStyleProfile,
        historyLength: config.historyLength,
        dailyReplyLimit: config.dailyReplyLimit,
        perContactCooldownSec: config.perContactCooldownSec,
      });
    }
  }, [config, draft]);

  if (isLoading || !draft) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const patch = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const handleSave = async () => {
    const saved = await updateConfig({
      ...draft,
      systemPromptExtra: draft.systemPromptExtra.trim() || undefined,
    });
    if (saved) {
      toast.success(t("communityBot.behavior.saved"));
    } else {
      toast.error(t("communityBot.behavior.saveFailed"));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Activation + model */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-text">
            {t("communityBot.behavior.engine")}
          </h3>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">
                {t("communityBot.behavior.autoReplies")}
              </p>
              <p className="text-xs text-text-muted">
                {t("communityBot.behavior.autoRepliesHint")}
              </p>
            </div>
            <Switch
              checked={draft.isEnabled}
              onCheckedChange={(v) => patch("isEnabled", v)}
              aria-label={t("communityBot.behavior.autoReplies")}
            />
          </div>

          <ProviderSelect
            toolModes={["chat"]}
            value={draft.modelId}
            onChange={(modelId) => patch("modelId", modelId)}
            label={t("communityBot.behavior.chatModel")}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-text">
              {t("communityBot.behavior.temperature", {
                value: draft.temperature.toFixed(2),
              })}
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={draft.temperature}
              onChange={(e) => patch("temperature", Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-text-muted">
              {t("communityBot.behavior.temperatureHint")}
            </p>
          </div>

          <Input
            label={t("communityBot.behavior.maxTokens")}
            type="number"
            min={50}
            max={4000}
            value={draft.maxTokens}
            onChange={(e) =>
              patch("maxTokens", Math.max(50, Number(e.target.value) || 50))
            }
          />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">
                {t("communityBot.behavior.useStyle")}
              </p>
              <p className="text-xs text-text-muted">
                {t("communityBot.behavior.useStyleHint")}
              </p>
            </div>
            <Switch
              checked={draft.useStyleProfile}
              onCheckedChange={(v) => patch("useStyleProfile", v)}
              aria-label={t("communityBot.behavior.useStyle")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Limits + instructions */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-text">
            {t("communityBot.behavior.guardrails")}
          </h3>
        </CardHeader>
        <CardContent className="space-y-5">
          <Input
            label={t("communityBot.behavior.dailyLimit")}
            type="number"
            min={0}
            max={5000}
            value={draft.dailyReplyLimit}
            onChange={(e) =>
              patch("dailyReplyLimit", Math.max(0, Number(e.target.value) || 0))
            }
          />

          <Input
            label={t("communityBot.behavior.cooldown")}
            type="number"
            min={0}
            max={3600}
            value={draft.perContactCooldownSec}
            onChange={(e) =>
              patch(
                "perContactCooldownSec",
                Math.max(0, Number(e.target.value) || 0),
              )
            }
          />

          <Input
            label={t("communityBot.behavior.memory")}
            type="number"
            min={0}
            max={50}
            value={draft.historyLength}
            onChange={(e) =>
              patch("historyLength", Math.max(0, Number(e.target.value) || 0))
            }
          />

          <Textarea
            label={t("communityBot.behavior.extraInstructions")}
            placeholder={t("communityBot.behavior.extraPlaceholder")}
            rows={5}
            maxLength={2000}
            value={draft.systemPromptExtra}
            onChange={(e) => patch("systemPromptExtra", e.target.value)}
          />

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />{" "}
                {t("communityBot.behavior.saving")}
              </>
            ) : (
              <>
                <Save size={16} /> {t("communityBot.behavior.save")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
