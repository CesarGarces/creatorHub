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
      toast.success("Bot configuration saved");
    } else {
      toast.error("Could not save the configuration");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Activation + model */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-text">Engine</h3>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Auto-replies</p>
              <p className="text-xs text-text-muted">
                Master switch — when off, incoming messages are stored but never
                answered.
              </p>
            </div>
            <Switch
              checked={draft.isEnabled}
              onCheckedChange={(v) => patch("isEnabled", v)}
            />
          </div>

          <ProviderSelect
            toolModes={["chat"]}
            value={draft.modelId}
            onChange={(modelId) => patch("modelId", modelId)}
            label="Chat model"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-text">
              Temperature: {draft.temperature.toFixed(2)}
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
              Lower = more predictable, higher = more creative.
            </p>
          </div>

          <Input
            label="Max reply tokens"
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
                Use my style profile
              </p>
              <p className="text-xs text-text-muted">
                Inject your tone, vocabulary and samples into every reply
                (trained in Settings → Style).
              </p>
            </div>
            <Switch
              checked={draft.useStyleProfile}
              onCheckedChange={(v) => patch("useStyleProfile", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Limits + instructions */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-text">Guardrails & instructions</h3>
        </CardHeader>
        <CardContent className="space-y-5">
          <Input
            label="Daily reply limit"
            type="number"
            min={0}
            max={5000}
            value={draft.dailyReplyLimit}
            onChange={(e) =>
              patch("dailyReplyLimit", Math.max(0, Number(e.target.value) || 0))
            }
          />

          <Input
            label="Cooldown per fan (seconds)"
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
            label="Conversation memory (messages)"
            type="number"
            min={0}
            max={50}
            value={draft.historyLength}
            onChange={(e) =>
              patch("historyLength", Math.max(0, Number(e.target.value) || 0))
            }
          />

          <Textarea
            label="Extra instructions for the bot (optional)"
            placeholder='e.g. "Never discuss pricing. If someone asks for collabs, tell them to email me."'
            rows={5}
            maxLength={2000}
            value={draft.systemPromptExtra}
            onChange={(e) => patch("systemPromptExtra", e.target.value)}
          />

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save size={16} /> Save configuration
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
