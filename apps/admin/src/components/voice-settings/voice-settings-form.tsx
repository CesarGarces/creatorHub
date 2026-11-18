"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  AudioLines,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Square,
  Timer,
} from "lucide-react";
import { Button, Input, Switch } from "@creator-hub/ui";
import type {
  TTSProviderName,
  UpdateVoiceSettingsRequest,
} from "@creator-hub/shared-types";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";
import {
  CUSTOM_VOICE,
  FREE_TIER_PERIODS,
  STT_MODEL_OPTIONS,
  TTS_LANGUAGES,
  creditsFor,
  defaultVoiceForm,
  formFromSettings,
  hasVoiceErrors,
  isVoiceFormDirty,
  modelsFor,
  toVoiceSettingsPayload,
  validateVoiceForm,
  voiceIdOf,
  withVoiceModel,
  type FreeTierPeriod,
  type TTSLanguage,
  type TTSVoiceOption,
  type VoiceFormErrors,
  type VoiceSettings,
  type VoiceSettingsForm as FormState,
} from "@/lib/voice-settings-form";
import { ttsVoiceInfo, ttsVoicesFor } from "@creator-hub/shared-types";

/** A voice sample from `POST /admin/voice-settings/preview`. */
export interface VoicePreviewAudio {
  data: string;
  mimeType: string;
}

export interface VoiceSettingsFormProps {
  /** Saved settings (`GET /admin/voice-settings`). */
  settings: VoiceSettings;
  /** Who speaks: Deepgram (API key set), the dev mock, or nobody (null). */
  ttsProvider: TTSProviderName | null;
  /** Saves the form (`PUT /admin/voice-settings`). */
  onSave: (payload: UpdateVoiceSettingsRequest) => void;
  /** A save is in flight. */
  saving?: boolean;
  /** Speaks a sample with a voice; omit to hide the play buttons. */
  onPreview?: (
    language: TTSLanguage,
    voice: string,
  ) => Promise<VoicePreviewAudio>;
  /** Called when a preview can't be played (e.g. to show a toast). */
  onPreviewError?: (error: unknown) => void;
}

/** `aria-describedby` from the ids that apply. */
const ids = (...list: Array<string | false | undefined>) =>
  list.filter(Boolean).join(" ") || undefined;

const SELECT_CLASS =
  "w-full min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary sm:min-h-0 disabled:opacity-50";

const ACCENTS = new Set([
  "American",
  "Argentine",
  "Australian",
  "Brazilian",
  "British",
  "Colombian",
  "Filipino",
  "Irish",
  "Latin American",
  "Mexican",
  "Peninsular",
]);

/**
 * Admin → Voice (STT & TTS): the Deepgram speech-to-text model, the Aura
 * voice ("actor") that speaks each language, both prices per second and
 * the Free plan's minutes with Robotina.
 * Validates like the API; remount it (`key`) to load newly saved settings.
 */
export function VoiceSettingsForm({
  settings,
  ttsProvider,
  onSave,
  saving = false,
  onPreview,
  onPreviewError,
}: VoiceSettingsFormProps) {
  const { t, formatDate } = useI18n();
  const [form, setForm] = useState<FormState>(() => formFromSettings(settings));
  const [errors, setErrors] = useState<VoiceFormErrors>({});
  const [playing, setPlaying] = useState<TTSLanguage | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<TTSLanguage | null>(
    null,
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const dirty = isVoiceFormDirty(form, settings);

  const change = (next: FormState) => {
    setForm(next);
    // Errors are re-checked as the admin fixes them.
    if (hasVoiceErrors(errors)) setErrors(validateVoiceForm(next));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateVoiceForm(form);
    setErrors(found);
    if (hasVoiceErrors(found)) return;
    onSave(toVoiceSettingsPayload(form));
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  };

  const preview = async (language: TTSLanguage) => {
    if (!onPreview) return;
    if (playing === language) {
      stopAudio();
      return;
    }
    stopAudio();
    setLoadingPreview(language);
    try {
      const sample = await onPreview(
        language,
        voiceIdOf(form.voices[language]),
      );
      const audio = new Audio(`data:${sample.mimeType};base64,${sample.data}`);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) stopAudio();
      };
      setPlaying(language);
      await audio.play();
    } catch (error) {
      stopAudio();
      onPreviewError?.(error);
    } finally {
      setLoadingPreview(null);
    }
  };

  const errorText = (field: keyof VoiceFormErrors, id: string) => {
    const code = errors[field];
    if (!code) return null;
    return (
      <p id={id} className="text-xs text-error">
        {t(`voice.errors.${code}`)}
      </p>
    );
  };

  const voiceLabel = (voice: TTSVoiceOption) =>
    t("voice.tts.voiceOption", {
      name: voice.name,
      accent: ACCENTS.has(voice.accent)
        ? t(`voice.tts.accents.${voice.accent}` as TranslationKey)
        : voice.accent,
      gender: t(`voice.tts.genders.${voice.gender}`),
    });

  const sttModel = STT_MODEL_OPTIONS.find((m) => m.id === form.sttModel);
  const sttExample = creditsFor(form.sttCreditsPerSecond, 60);
  const ttsExample = creditsFor(form.ttsCreditsPerSecond, 20);

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {ttsProvider !== "deepgram" && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-text"
        >
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden
          />
          <p>
            {ttsProvider === "mock"
              ? t("voice.providerMock")
              : t("voice.providerMissing")}
          </p>
        </div>
      )}

      {/* ── Speech-to-text ───────────────────────────────────────── */}
      <section
        aria-labelledby="voice-stt-title"
        className="rounded-xl border border-border bg-surface p-4 sm:p-6"
      >
        <header className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mic size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="voice-stt-title"
              className="text-base font-semibold text-text sm:text-lg"
            >
              {t("voice.stt.title")}
            </h2>
            <p className="text-sm text-text-muted">{t("voice.stt.subtitle")}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-text">
              {t("voice.provider")}
            </span>
            <p className="flex min-h-11 items-center rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text sm:min-h-9">
              Deepgram
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="voice-stt-model"
              className="text-sm font-medium text-text"
            >
              {t("voice.model")}
            </label>
            <select
              id="voice-stt-model"
              value={form.sttModel}
              onChange={(e) => change({ ...form, sttModel: e.target.value })}
              className={SELECT_CLASS}
              aria-describedby="voice-stt-model-hint"
            >
              {STT_MODEL_OPTIONS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.id})
                </option>
              ))}
            </select>
            <p id="voice-stt-model-hint" className="text-xs text-text-muted">
              {sttModel?.multilingual
                ? t("voice.stt.multilingual")
                : t("voice.stt.singleLanguage")}
            </p>
            {errorText("sttModel", "voice-stt-model-error")}
          </div>

          <RateField
            id="voice-stt-rate"
            value={form.sttCreditsPerSecond}
            onChange={(value) =>
              change({ ...form, sttCreditsPerSecond: value })
            }
            invalid={Boolean(errors.sttCreditsPerSecond)}
            hint={t("voice.priceHint")}
            example={
              sttExample === null
                ? null
                : t("voice.stt.example", { count: sttExample })
            }
            error={errorText("sttCreditsPerSecond", "voice-stt-rate-error")}
          />
        </div>
      </section>

      {/* ── Text-to-speech ───────────────────────────────────────── */}
      <section
        aria-labelledby="voice-tts-title"
        className="rounded-xl border border-border bg-surface p-4 sm:p-6"
      >
        <header className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <AudioLines size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="voice-tts-title"
              className="text-base font-semibold text-text sm:text-lg"
            >
              {t("voice.tts.title")}
            </h2>
            <p className="text-sm text-text-muted">{t("voice.tts.subtitle")}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-text">
              {t("voice.provider")}
            </span>
            <p className="flex min-h-11 items-center rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text sm:min-h-9">
              Deepgram
            </p>
          </div>
          <div className="hidden md:block" aria-hidden />
          <RateField
            id="voice-tts-rate"
            value={form.ttsCreditsPerSecond}
            onChange={(value) =>
              change({ ...form, ttsCreditsPerSecond: value })
            }
            invalid={Boolean(errors.ttsCreditsPerSecond)}
            hint={t("voice.tts.priceHint")}
            example={
              ttsExample === null
                ? null
                : t("voice.tts.example", { count: ttsExample })
            }
            error={errorText("ttsCreditsPerSecond", "voice-tts-rate-error")}
          />
        </div>

        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {TTS_LANGUAGES.map((language) => {
            const entry = form.voices[language];
            const field = `ttsVoices.${language}` as const;
            const catalog = ttsVoicesFor(entry.model, language);
            const voiceId = voiceIdOf(entry);
            const info = ttsVoiceInfo(voiceId || entry.model, language);
            const languageName = t(`voice.tts.languages.${language}`);
            const isCustom = entry.voice === CUSTOM_VOICE;
            const errorId = `voice-${language}-error`;
            return (
              <li
                key={language}
                className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[9rem_minmax(0,10rem)_minmax(0,1fr)_auto] md:items-start"
              >
                <div className="flex items-center gap-2 md:min-h-9">
                  <span className="rounded-md bg-surface-elevated px-2 py-0.5 font-mono text-xs uppercase text-text-muted">
                    {language}
                  </span>
                  <span className="text-sm font-medium text-text">
                    {languageName}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={`voice-${language}-model`}
                    className="text-xs font-medium text-text-muted md:sr-only"
                  >
                    {t("voice.model")} ({languageName})
                  </label>
                  <select
                    id={`voice-${language}-model`}
                    value={entry.model}
                    onChange={(e) =>
                      change(withVoiceModel(form, language, e.target.value))
                    }
                    className={SELECT_CLASS}
                  >
                    {modelsFor(language).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={`voice-${language}-voice`}
                    className="text-xs font-medium text-text-muted md:sr-only"
                  >
                    {t("voice.tts.voice")} ({languageName})
                  </label>
                  <select
                    id={`voice-${language}-voice`}
                    value={entry.voice}
                    onChange={(e) =>
                      change({
                        ...form,
                        voices: {
                          ...form.voices,
                          [language]: { ...entry, voice: e.target.value },
                        },
                      })
                    }
                    className={SELECT_CLASS}
                    aria-invalid={Boolean(errors[field]) && !isCustom}
                    aria-describedby={
                      errors[field] && !isCustom ? errorId : undefined
                    }
                  >
                    {catalog.map((voice) => (
                      <option key={voice.model} value={voice.model}>
                        {voiceLabel(voice)}
                      </option>
                    ))}
                    <option value={CUSTOM_VOICE}>
                      {t("voice.tts.customVoice")}
                    </option>
                  </select>
                  {isCustom && (
                    <div className="space-y-1">
                      <label
                        htmlFor={`voice-${language}-custom`}
                        className="text-xs font-medium text-text-muted"
                      >
                        {t("voice.tts.customVoiceLabel")} ({languageName})
                      </label>
                      <Input
                        id={`voice-${language}-custom`}
                        value={entry.customVoice}
                        onChange={(e) =>
                          change({
                            ...form,
                            voices: {
                              ...form.voices,
                              [language]: {
                                ...entry,
                                customVoice: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder={`${entry.model}-name-${language}`}
                        className="font-mono"
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={Boolean(errors[field])}
                        aria-describedby={ids(
                          `voice-${language}-custom-hint`,
                          errors[field] && errorId,
                        )}
                      />
                      <p
                        id={`voice-${language}-custom-hint`}
                        className="text-xs text-text-dim"
                      >
                        {t("voice.tts.customVoiceHint", {
                          example: `${entry.model}-${
                            catalog[0]?.name.toLowerCase() ?? "name"
                          }-${language}`,
                        })}
                      </p>
                    </div>
                  )}
                  {errorText(field, errorId)}
                </div>

                {onPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void preview(language)}
                    disabled={!voiceId || loadingPreview !== null}
                    aria-label={
                      playing === language
                        ? t("voice.tts.playing")
                        : t("voice.tts.play", { name: info.name })
                    }
                    title={t("voice.tts.play", { name: info.name })}
                    className="min-h-11 gap-2 justify-self-start sm:min-h-9"
                  >
                    {loadingPreview === language ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                    ) : playing === language ? (
                      <Square size={16} aria-hidden />
                    ) : (
                      <Play size={16} aria-hidden />
                    )}
                    <span className="md:sr-only">
                      {playing === language
                        ? t("voice.tts.playing")
                        : t("voice.tts.play", { name: info.name })}
                    </span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Free plan limit ──────────────────────────────────────── */}
      <section
        aria-labelledby="voice-free-title"
        className="rounded-xl border border-border bg-surface p-4 sm:p-6"
      >
        <header className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Timer size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="voice-free-title"
              className="text-base font-semibold text-text sm:text-lg"
            >
              {t("voice.freeTier.title")}
            </h2>
            <p className="text-sm text-text-muted">
              {t("voice.freeTier.subtitle")}
            </p>
          </div>
        </header>

        <div className="flex items-center gap-3">
          <Switch
            id="voice-free-enabled"
            checked={form.freeTierEnabled}
            onCheckedChange={(checked) =>
              change({ ...form, freeTierEnabled: checked })
            }
            aria-describedby="voice-free-enabled-hint"
          />
          <label
            htmlFor="voice-free-enabled"
            className="text-sm font-medium text-text"
          >
            {t("voice.freeTier.enable")}
          </label>
        </div>
        <p
          id="voice-free-enabled-hint"
          className="mt-2 text-xs text-text-muted"
        >
          {form.freeTierEnabled
            ? t("voice.freeTier.upgradeHint")
            : t("voice.freeTier.unlimited")}
        </p>

        {form.freeTierEnabled && (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="voice-free-minutes"
                className="text-sm font-medium text-text"
              >
                {t("voice.freeTier.minutes")}
              </label>
              <div className="relative">
                <Input
                  id="voice-free-minutes"
                  type="text"
                  inputMode="numeric"
                  value={form.freeTierMinutes}
                  onChange={(e) =>
                    change({ ...form, freeTierMinutes: e.target.value })
                  }
                  className="pr-14"
                  aria-invalid={Boolean(errors.freeTierMinutes)}
                  aria-describedby={ids(
                    "voice-free-minutes-hint",
                    errors.freeTierMinutes && "voice-free-minutes-error",
                  )}
                />
                <span
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-text-dim"
                  aria-hidden
                >
                  min
                </span>
              </div>
              <p
                id="voice-free-minutes-hint"
                className="text-xs text-text-muted"
              >
                {t("voice.freeTier.minutesHint")}
              </p>
              {errorText("freeTierMinutes", "voice-free-minutes-error")}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="voice-free-period"
                className="text-sm font-medium text-text"
              >
                {t("voice.freeTier.period")}
              </label>
              <select
                id="voice-free-period"
                value={form.freeTierPeriod}
                onChange={(e) =>
                  change({
                    ...form,
                    freeTierPeriod: e.target.value as FreeTierPeriod,
                  })
                }
                className={SELECT_CLASS}
              >
                {FREE_TIER_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {t(`voice.freeTier.periods.${period}`)}
                  </option>
                ))}
              </select>
              {errorText("freeTierPeriod", "voice-free-period-error")}
            </div>
          </div>
        )}
      </section>

      {/* ── Save bar ─────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 -mx-1 rounded-xl border border-border bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg shadow-black/20 backdrop-blur sm:mx-0 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted" aria-live="polite">
            {dirty
              ? t("voice.unsaved")
              : settings.updatedAt
                ? t("voice.lastSaved", {
                    date: formatDate(settings.updatedAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })
                : t("voice.neverSaved")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setErrors({});
                setForm(defaultVoiceForm());
              }}
              disabled={saving}
              className="min-h-11 gap-2 whitespace-nowrap sm:min-h-9"
            >
              <RotateCcw size={16} className="hidden sm:block" aria-hidden />
              {t("voice.reset")}
            </Button>
            <Button
              type="submit"
              disabled={saving || !dirty}
              className="min-h-11 gap-2 whitespace-nowrap sm:min-h-9"
            >
              {saving && (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              )}
              {saving ? t("common.saving") : t("common.saveChanges")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function RateField({
  id,
  value,
  onChange,
  invalid,
  hint,
  example,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  hint: string;
  example: string | null;
  error: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {t("voice.pricePerSecond")}
      </label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-14"
          aria-invalid={invalid}
          aria-describedby={ids(`${id}-hint`, invalid && `${id}-error`)}
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-text-dim"
          aria-hidden
        >
          cr/s
        </span>
      </div>
      <p id={`${id}-hint`} className="text-xs text-text-muted">
        {hint}
        {example && (
          <>
            {" "}
            <strong className="font-medium text-text">{example}</strong>
          </>
        )}
      </p>
      {error}
    </div>
  );
}
