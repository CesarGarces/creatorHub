"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wand2,
  X,
} from "lucide-react";
import { ActionConfirmDialog, Button, Textarea, cn } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { ProviderSelect } from "@/components/provider-select";
import { VideoDropzone } from "@/components/video-clipper/video-dropzone";
import { HeavyFilesNote } from "@/components/video-clipper/heavy-files-note";
import { KeyframeStrip } from "@/components/video-clipper/keyframe-strip";
import { ClipTimeline } from "@/components/video-clipper/clip-timeline";
import {
  ClipCard,
  type ClipExportState,
} from "@/components/video-clipper/clip-card";
import { SuggestionsPanel } from "@/components/video-clipper/suggestions-panel";
import { AnalysisHistory } from "@/components/video-clipper/analysis-history";
import { useI18n } from "@/i18n/i18n-provider";
import { useLocalVideo, type LocalVideoError } from "@/hooks/use-local-video";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { useCreditsStore } from "@/store/credits.store";
import { useVideoClipperStore } from "@/store/video-clipper.store";
import {
  CLIP_LENGTH_RULES,
  CLIP_PLATFORMS,
  EXPORT_FORMATS,
  MAX_VIDEO_BYTES,
  type ClipPlatform,
  type ExportFormat,
} from "@/lib/video-clipper/constants";
import { formatBytes, formatTimestamp } from "@/lib/video-clipper/format";
import {
  clipFileName,
  downloadBlob,
  exportClip,
  isClipExportSupported,
} from "@/lib/video-clipper/clip-export";
import { isAbortError } from "@/lib/video-clipper/keyframes";
import { copyText } from "@/lib/video-clipper/clipboard";
import {
  discardAnalysisOnLeave,
  flushPendingDeletions,
} from "@/lib/video-clipper/pending-deletions";
import type { TranslationKey } from "@/i18n/translate";

/** Vision models are text-generation models flagged `supportsVision`. */
const VISION_TOOL_MODES = ["text"];
/** A reopened analysis belongs to a file with (about) the same duration. */
const SAME_VIDEO_TOLERANCE_SEC = 1.5;

const LOCAL_ERROR_KEYS: Record<LocalVideoError, TranslationKey> = {
  type: "videoClipper.upload.errors.type",
  empty: "videoClipper.upload.errors.empty",
  size: "videoClipper.upload.errors.size",
  decode: "videoClipper.upload.errors.decode",
  sampling: "videoClipper.upload.errors.sampling",
};

export default function VideoClipperPage() {
  const { t, locale } = useI18n();
  const local = useLocalVideo();

  const balance = useCreditsStore((s) => s.balance);
  const fetchBalance = useCreditsStore((s) => s.fetchBalance);

  const model = useVideoClipperStore((s) => s.model);
  const platform = useVideoClipperStore((s) => s.platform);
  const context = useVideoClipperStore((s) => s.context);
  const estimate = useVideoClipperStore((s) => s.estimate);
  const isAnalyzing = useVideoClipperStore((s) => s.isAnalyzing);
  const analysis = useVideoClipperStore((s) => s.analysis);
  const ranges = useVideoClipperStore((s) => s.ranges);
  const analysisError = useVideoClipperStore((s) => s.error);
  const history = useVideoClipperStore((s) => s.history);
  const {
    setModel,
    setPlatform,
    setContext,
    setRange,
    resetRange,
    fetchEstimate,
    analyze,
    fetchHistory,
    openAnalysis,
    deleteAnalysis,
    clearAnalysis,
    clearError,
    forgetAnalysis,
  } = useVideoClipperStore.getState();

  const playerRef = useRef<HTMLVideoElement>(null);
  const changeInputRef = useRef<HTMLInputElement>(null);
  const clipsRef = useRef<HTMLElement>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("original");
  const [exports, setExports] = useState<Record<string, ClipExportState>>({});
  // Decided on the client only (no hydration mismatch).
  const [exportSupported, setExportSupported] = useState(true);

  const modelLabelId = useId();
  const contextId = useId();

  useEffect(() => {
    setExportSupported(isClipExportSupported());
    void fetchBalance();
    // Analyses discarded by leaving the page last time are deleted first,
    // so they never show up in the history again.
    void flushPendingDeletions()
      .then((gone) => gone.forEach(forgetAnalysis))
      .finally(() => void fetchHistory(true));
    return () => {
      analyzeAbortRef.current?.abort();
      exportAbortRef.current?.abort();
    };
  }, [fetchBalance, fetchHistory, forgetAnalysis]);

  // Cost of the analysis for this model and number of keyframes.
  useEffect(() => {
    if (model && local.plannedFrames > 0) {
      void fetchEstimate(model, local.plannedFrames);
    }
  }, [model, local.plannedFrames, fetchEstimate]);

  const hasVideo = !!local.url && local.status !== "error";
  const result = analysis?.result ?? null;
  const videoMatchesAnalysis =
    !!result &&
    !!local.info &&
    Math.abs(local.info.durationSec - result.video.durationSec) <=
      SAME_VIDEO_TOLERANCE_SEC;
  const canPlay = hasVideo && videoMatchesAnalysis;
  // The analysis of the video held in this tab's memory.
  const liveAnalysisId = canPlay ? (analysis?.id ?? null) : null;

  // The video only exists in this tab: warn before refresh / close / leaving.
  // Accepting deletes the analysis made from it (done on the next visit if
  // the browser can't finish the request while unloading).
  const leave = useLeaveGuard({
    active: hasVideo,
    onLeave: () => {
      if (!liveAnalysisId) return;
      discardAnalysisOnLeave(liveAnalysisId);
      forgetAnalysis(liveAnalysisId);
    },
  });

  // A different video makes the loaded analysis obsolete.
  useEffect(() => {
    if (local.info && analysis && !videoMatchesAnalysis) {
      clearAnalysis();
      setExports({});
      setActiveClipId(null);
    }
    // Only when a new file has been read (not when an analysis is opened).
  }, [local.info]);

  const clips = useMemo(() => result?.highlights ?? [], [result]);
  const rules = CLIP_LENGTH_RULES[result?.platform ?? platform];
  const notEnoughCredits = estimate !== null && balance < estimate.total;
  const framesReady = local.status === "ready" && local.frames.length > 0;
  const canAnalyze =
    framesReady && !!model && !isAnalyzing && !notEnoughCredits;
  const exportingId =
    Object.entries(exports).find(([, s]) => s.status === "exporting")?.[0] ??
    null;

  // ── Video ingest ─────────────────────────────────────────────────────
  const stopPlayback = () => {
    playerRef.current?.pause();
    setPreviewId(null);
  };

  const handleFile = (file: File) => {
    stopPlayback();
    exportAbortRef.current?.abort();
    setCurrentTime(null);
    void local.selectFile(file);
  };

  const removeVideo = () => {
    stopPlayback();
    exportAbortRef.current?.abort();
    analyzeAbortRef.current?.abort();
    setCurrentTime(null);
    setExports({});
    local.clear();
  };

  /** A timeline handle is being moved: show that exact frame. */
  const scrubTo = (time: number) => {
    const player = playerRef.current;
    if (!player) return;
    if (!player.paused) player.pause();
    setPreviewId(null);
    player.currentTime = time;
    setCurrentTime(time);
  };

  const seekTo = (time: number) => {
    const player = playerRef.current;
    if (!player) return;
    setPreviewId(null);
    player.currentTime = time;
  };

  // ── Analysis ─────────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!canAnalyze || !local.info) return;
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    const done = await analyze({
      model,
      video: local.info,
      frames: local.frames,
      platform,
      language: locale,
      context,
      signal: controller.signal,
    });
    analyzeAbortRef.current = null;
    if (!done) return;
    void fetchBalance();
    setExports({});
    setActiveClipId(done.result.highlights[0]?.id ?? null);
    toast.success(
      done.creditsCharged
        ? t("videoClipper.analyze.charged", { count: done.creditsCharged })
        : t("videoClipper.analyze.chargedFree"),
    );
    clipsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelAnalysis = () => analyzeAbortRef.current?.abort();

  // ── Clips: preview / export ──────────────────────────────────────────
  const previewClip = (clipId: string) => {
    const player = playerRef.current;
    const range = ranges[clipId];
    if (!player || !range) return;
    setActiveClipId(clipId);
    setPreviewId(clipId);
    player.currentTime = range.start;
    void player.play().catch(() => setPreviewId(null));
    player.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  };

  const onTimeUpdate = () => {
    const player = playerRef.current;
    if (!player) return;
    setCurrentTime(player.currentTime);
    const range = previewId ? ranges[previewId] : null;
    if (range && player.currentTime >= range.end) {
      player.pause();
      setPreviewId(null);
    }
  };

  const exportClipById = async (clipId: string, index: number) => {
    const range = ranges[clipId];
    if (!local.url || !local.info || !range || exportingId) return;
    stopPlayback();
    const controller = new AbortController();
    exportAbortRef.current = controller;
    const setState = (state: ClipExportState) =>
      setExports((s) => ({ ...s, [clipId]: state }));
    setState({ status: "exporting", progress: 0 });
    try {
      const clip = await exportClip({
        url: local.url,
        start: range.start,
        end: range.end,
        format: exportFormat,
        signal: controller.signal,
        onProgress: (progress) => setState({ status: "exporting", progress }),
      });
      downloadBlob(
        clip.blob,
        clipFileName(local.info.fileName, index, range, clip.extension),
      );
      setState({ status: "done", progress: 1 });
      toast.success(t("videoClipper.clips.exported"));
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        setState({ status: "idle", progress: 0 });
      } else {
        setState({ status: "error", progress: 0 });
        toast.error(t("videoClipper.clips.exportFailed"));
      }
    } finally {
      if (exportAbortRef.current === controller) exportAbortRef.current = null;
    }
  };

  const copy = useCallback(
    async (text: string) => {
      if (await copyText(text)) toast.success(t("videoClipper.results.copied"));
      else toast.error(t("videoClipper.results.copyFailed"));
    },
    [t],
  );

  const openFromHistory = async (id: string) => {
    stopPlayback();
    setExports({});
    await openAnalysis(id);
    setActiveClipId(null);
    clipsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const removeFromHistory = async (id: string) => {
    if (await deleteAnalysis(id))
      toast.success(t("videoClipper.history.deleted"));
  };

  const localError = local.error
    ? t(LOCAL_ERROR_KEYS[local.error], {
        size: formatBytes(local.rejectedSize ?? 0),
        max: formatBytes(MAX_VIDEO_BYTES),
      })
    : null;

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.tools"), href: "/tools" },
          { label: t("toolCatalog.video-clipper.name") },
        ]}
      />
      <div className="space-y-6 p-4 animate-fade-in sm:p-6">
        <header>
          <h1 className="text-xl font-bold text-text sm:text-2xl">
            {t("videoClipper.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-text-muted">
            {t("videoClipper.subtitle")}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          {/* ── Media: upload, player, timeline, keyframes ── */}
          <div className="min-w-0 space-y-4">
            {localError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-error/40 bg-error-light px-3 py-2 text-sm text-error"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p className="min-w-0 flex-1">{localError}</p>
                {local.status !== "error" && (
                  <button
                    type="button"
                    onClick={local.dismissError}
                    aria-label={t("videoClipper.upload.dismiss")}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-error/10 pointer-coarse:h-11 pointer-coarse:w-11"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {!hasVideo ? (
              <VideoDropzone onFile={handleFile} />
            ) : (
              <section
                aria-label={t("videoClipper.video.player")}
                className="space-y-4 rounded-xl border border-border bg-surface p-3 sm:p-4"
              >
                <video
                  ref={playerRef}
                  src={local.url ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={t("videoClipper.video.player")}
                  data-testid="video-player"
                  onTimeUpdate={onTimeUpdate}
                  onPause={() => setPreviewId(null)}
                  className="aspect-video w-full rounded-lg bg-black object-contain"
                />

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-text"
                      title={local.info?.fileName}
                    >
                      {local.info?.fileName}
                    </p>
                    {local.info && (
                      <p className="font-mono text-xs text-text-muted tabular-nums">
                        {formatTimestamp(local.info.durationSec)} ·{" "}
                        {local.info.width}×{local.info.height} ·{" "}
                        {formatBytes(local.info.sizeBytes)}
                      </p>
                    )}
                  </div>
                  <input
                    ref={changeInputRef}
                    type="file"
                    accept="video/*,.mp4,.mov,.m4v,.webm,.mkv"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => changeInputRef.current?.click()}
                    disabled={isAnalyzing || !!exportingId}
                    className="pointer-coarse:h-11"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("videoClipper.video.change")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeVideo}
                    disabled={isAnalyzing || !!exportingId}
                    aria-label={t("videoClipper.video.remove")}
                    className="pointer-coarse:h-11"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                <p
                  role="note"
                  data-testid="leave-notice"
                  className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-light px-3 py-2 text-xs leading-relaxed text-text"
                >
                  <Info
                    className="mt-px h-3.5 w-3.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  <span>
                    {liveAnalysisId
                      ? t("videoClipper.leave.noticeAnalysis")
                      : t("videoClipper.leave.notice")}
                  </span>
                </p>

                {(local.status === "reading" ||
                  local.status === "sampling") && (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-sm text-text-muted"
                  >
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    {local.status === "reading"
                      ? t("videoClipper.video.reading")
                      : t("videoClipper.video.sampling", {
                          done: local.frames.length,
                          total: local.plannedFrames,
                        })}
                  </p>
                )}

                {result && canPlay && (
                  <ClipTimeline
                    durationSec={
                      local.info?.durationSec ?? result.video.durationSec
                    }
                    clips={clips.map((clip, i) => ({
                      id: clip.id,
                      index: i + 1,
                      score: clip.score,
                      ...(ranges[clip.id] ?? clip),
                    }))}
                    activeId={activeClipId}
                    currentTime={currentTime}
                    keyframes={local.frames.map((f) => f.timestamp)}
                    maxLength={rules.max}
                    onSelect={previewClip}
                    onRangeChange={(clipId, range) => setRange(clipId, range)}
                    onScrub={scrubTo}
                  />
                )}

                {local.info && local.plannedFrames > 0 && (
                  <KeyframeStrip
                    frames={local.frames}
                    total={local.plannedFrames}
                    durationSec={local.info.durationSec}
                    activeTime={currentTime}
                    onSelect={seekTo}
                  />
                )}
              </section>
            )}

            {(!hasVideo || local.error === "size") && (
              <HeavyFilesNote emphasized={local.error === "size"} />
            )}

            {result && !canPlay && (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted">
                {t("videoClipper.video.reattach", {
                  name: result.video.fileName,
                })}
              </p>
            )}
          </div>

          {/* ── Controls: model, platform, cost, analyze; suggestions ── */}
          <div className="min-w-0 space-y-4">
            <section
              aria-labelledby="video-clipper-analyze"
              className="space-y-4 rounded-xl border border-border bg-surface p-4"
            >
              <h2
                id="video-clipper-analyze"
                className="flex items-center gap-2 text-base font-semibold text-text"
              >
                <Wand2 className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("videoClipper.analyze.heading")}
              </h2>

              <div>
                <p
                  id={modelLabelId}
                  className="mb-1.5 text-sm font-medium text-text"
                >
                  {t("videoClipper.analyze.model")}
                </p>
                <div role="group" aria-labelledby={modelLabelId}>
                  <ProviderSelect
                    toolModes={VISION_TOOL_MODES}
                    requireVision
                    value={model}
                    onChange={(id) => setModel(id)}
                    disabled={isAnalyzing}
                    label={t("videoClipper.analyze.model")}
                    emptyMessage={t("videoClipper.analyze.noModels")}
                  />
                </div>
              </div>

              <fieldset disabled={isAnalyzing}>
                <legend className="mb-1.5 text-sm font-medium text-text">
                  {t("videoClipper.analyze.platform")}
                </legend>
                <ChipRadioGroup
                  name="clip-platform"
                  options={CLIP_PLATFORMS.map((p) => ({
                    value: p,
                    label: t(`videoClipper.analyze.platforms.${p}`),
                  }))}
                  value={platform}
                  onChange={(p) => setPlatform(p as ClipPlatform)}
                />
                <p className="mt-1.5 text-xs text-text-dim">
                  {t("videoClipper.analyze.platformHint", {
                    min: CLIP_LENGTH_RULES[platform].min,
                    max: CLIP_LENGTH_RULES[platform].max,
                  })}
                </p>
              </fieldset>

              <div>
                <label
                  htmlFor={contextId}
                  className="mb-1.5 block text-sm font-medium text-text"
                >
                  {t("videoClipper.analyze.context")}
                </label>
                <Textarea
                  id={contextId}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  maxLength={500}
                  rows={2}
                  disabled={isAnalyzing}
                  placeholder={t("videoClipper.analyze.contextPlaceholder")}
                />
              </div>

              {estimate && hasVideo && (
                <div
                  data-testid="analysis-cost"
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    notEnoughCredits
                      ? "border-error/40 bg-error-light text-error"
                      : "border-border bg-surface-elevated/60 text-text",
                  )}
                >
                  <p className="font-medium">
                    {estimate.total > 0
                      ? t("videoClipper.analyze.cost", {
                          total: estimate.total,
                        })
                      : t("videoClipper.analyze.costFree")}
                  </p>
                  <p
                    className={cn(
                      "text-xs",
                      notEnoughCredits ? "text-error" : "text-text-muted",
                    )}
                  >
                    {t("videoClipper.analyze.costBreakdown", {
                      model: estimate.modelName,
                      modelCost: estimate.modelCost,
                      units: estimate.units,
                      frames: estimate.frames,
                    })}{" "}
                    · {t("videoClipper.analyze.balance", { balance })}
                  </p>
                  {notEnoughCredits && (
                    <p className="mt-1 text-xs">
                      {t("videoClipper.analyze.notEnough")}{" "}
                      <Link
                        href="/credits"
                        className="font-medium underline underline-offset-2"
                      >
                        {t("videoClipper.analyze.getCredits")}
                      </Link>
                    </p>
                  )}
                </div>
              )}

              {analysisError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-error/40 bg-error-light px-3 py-2 text-sm text-error"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p className="min-w-0 flex-1">{analysisError}</p>
                  <button
                    type="button"
                    onClick={clearError}
                    aria-label={t("videoClipper.upload.dismiss")}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-error/10 pointer-coarse:h-11 pointer-coarse:w-11"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {isAnalyzing ? (
                <div className="space-y-2">
                  <p
                    role="status"
                    className="flex items-center gap-2 text-sm text-text-muted"
                  >
                    <Loader2
                      className="h-4 w-4 animate-spin text-primary"
                      aria-hidden="true"
                    />
                    {t("videoClipper.analyze.analyzing", {
                      count: local.frames.length,
                      model: estimate?.modelName ?? model,
                    })}
                  </p>
                  <Button
                    variant="secondary"
                    className="w-full gap-2 pointer-coarse:h-11"
                    onClick={cancelAnalysis}
                  >
                    {t("videoClipper.analyze.cancel")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Button
                    className="w-full gap-2 pointer-coarse:h-11"
                    onClick={() => void runAnalysis()}
                    disabled={!canAnalyze}
                  >
                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                    {t("videoClipper.analyze.submit")}
                  </Button>
                  {!hasVideo && (
                    <p className="text-center text-xs text-text-dim">
                      {t("videoClipper.analyze.needVideo")}
                    </p>
                  )}
                  {hasVideo && !framesReady && (
                    <p className="text-center text-xs text-text-dim">
                      {t("videoClipper.analyze.waitFrames")}
                    </p>
                  )}
                </div>
              )}

              {hasVideo && (
                <p className="flex items-start gap-1.5 text-xs text-text-dim">
                  <ShieldCheck
                    className="mt-px h-3.5 w-3.5 shrink-0 text-secondary"
                    aria-hidden="true"
                  />
                  <span>{t("videoClipper.privacy")}</span>
                </p>
              )}
            </section>

            {result && (
              <section className="rounded-xl border border-border bg-surface p-4">
                <SuggestionsPanel result={result} onCopy={copy} />
              </section>
            )}
          </div>
        </div>

        {/* ── Detected clips ── */}
        {result && (
          <section
            ref={clipsRef}
            aria-labelledby="video-clipper-clips"
            className="scroll-mt-20 space-y-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="video-clipper-clips"
                  className="text-lg font-semibold text-text"
                >
                  {t("videoClipper.clips.heading")}
                </h2>
                <p className="text-sm text-text-muted">
                  {t("videoClipper.clips.count", { count: clips.length })} ·{" "}
                  {t(`videoClipper.analyze.platforms.${result.platform}`)}
                </p>
              </div>
              <fieldset disabled={!!exportingId}>
                <legend className="mb-1.5 text-xs font-medium text-text-muted">
                  {t("videoClipper.clips.format")}
                </legend>
                <ChipRadioGroup
                  name="export-format"
                  options={EXPORT_FORMATS.map((f) => ({
                    value: f,
                    label: t(`videoClipper.clips.formats.${f}`),
                  }))}
                  value={exportFormat}
                  onChange={(f) => setExportFormat(f as ExportFormat)}
                />
              </fieldset>
            </div>
            <p className="text-xs text-text-dim">
              {exportSupported
                ? t("videoClipper.clips.realtimeNote")
                : t("videoClipper.clips.unsupported")}
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {clips.map((clip, i) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  index={i + 1}
                  range={ranges[clip.id] ?? clip}
                  durationSec={result.video.durationSec}
                  maxLength={rules.max}
                  active={clip.id === activeClipId}
                  previewing={clip.id === previewId}
                  canPlay={canPlay}
                  exportSupported={exportSupported}
                  exportState={exports[clip.id]}
                  exportLocked={!!exportingId && exportingId !== clip.id}
                  onPreview={() => previewClip(clip.id)}
                  onStop={stopPlayback}
                  onExport={() => void exportClipById(clip.id, i + 1)}
                  onCancelExport={() => exportAbortRef.current?.abort()}
                  onRangeChange={(range) => setRange(clip.id, range)}
                  onResetRange={() => resetRange(clip.id)}
                  onCopy={(text) => void copy(text)}
                />
              ))}
            </div>
          </section>
        )}

        <AnalysisHistory
          items={history}
          activeId={analysis?.id ?? null}
          onOpen={(id) => void openFromHistory(id)}
          onDelete={(id) => void removeFromHistory(id)}
        />
      </div>

      {/* In-app navigation while the video is in memory (refresh/close use
          the browser's own prompt). */}
      <ActionConfirmDialog
        isOpen={leave.pendingHref !== null}
        onClose={leave.cancelLeave}
        onConfirm={leave.confirmLeave}
        title={t("videoClipper.leave.title")}
        description={
          liveAnalysisId
            ? t("videoClipper.leave.descriptionAnalysis")
            : t("videoClipper.leave.description")
        }
        confirmLabel={
          liveAnalysisId
            ? t("videoClipper.leave.confirmAnalysis")
            : t("videoClipper.leave.confirm")
        }
        cancelLabel={t("videoClipper.leave.stay")}
        confirmVariant={liveAnalysisId ? "danger" : "primary"}
      />
    </>
  );
}

/** Native radio inputs styled as chips (keyboard and screen-reader friendly). */
function ChipRadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label key={option.value} className="relative">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-11",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg",
              "peer-disabled:cursor-not-allowed",
              value === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface-elevated text-text-muted hover:text-text",
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
