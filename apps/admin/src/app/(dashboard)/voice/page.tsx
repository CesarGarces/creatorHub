"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  TTSLanguage,
  TTSProviderName,
  UpdateVoiceSettingsRequest,
  VoiceSettings,
} from "@creator-hub/shared-types";
import api from "@/lib/api";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import {
  VoiceSettingsForm,
  type VoicePreviewAudio,
} from "@/components/voice-settings/voice-settings-form";

interface VoiceSettingsResponse {
  settings: VoiceSettings;
  ttsProvider: TTSProviderName | null;
}

const QUERY_KEY = ["voice-settings"];

/** Admin → Voice (STT & TTS): Deepgram models, voices and prices. */
export default function VoiceSettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () =>
      (await api.get<VoiceSettingsResponse>("/admin/voice-settings")).data,
  });

  const save = useMutation({
    mutationFn: async (payload: UpdateVoiceSettingsRequest) =>
      (await api.put<VoiceSettingsResponse>("/admin/voice-settings", payload))
        .data,
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved);
      toast.success(t("voice.saved"));
    },
    onError: (error: unknown) => {
      toast.error(localizeError(error, "voice.saveFailed"));
    },
  });

  const preview = async (
    language: TTSLanguage,
    voice: string,
  ): Promise<VoicePreviewAudio> =>
    (
      await api.post<VoicePreviewAudio>("/admin/voice-settings/preview", {
        language,
        voice,
      })
    ).data;

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-text sm:text-2xl">
          {t("voice.title")}
        </h1>
        <p className="mt-1 text-sm text-text-muted">{t("voice.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="space-y-6" aria-busy="true">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : isError || !data ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6 text-sm text-text"
        >
          <p>{t("voice.loadFailed")}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface-elevated sm:min-h-0"
          >
            {t("voice.retry")}
          </button>
        </div>
      ) : (
        <VoiceSettingsForm
          // Remounts with the saved values after each save.
          key={data.settings.updatedAt ?? "defaults"}
          settings={data.settings}
          ttsProvider={data.ttsProvider}
          saving={save.isPending}
          onSave={(payload) => save.mutate(payload)}
          onPreview={preview}
          onPreviewError={(error) =>
            toast.error(localizeError(error, "voice.tts.playFailed"))
          }
        />
      )}
    </div>
  );
}
