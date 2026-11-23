"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  Check,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  cn,
} from "@creator-hub/ui";
import api from "@/lib/api";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import { ProviderSelect } from "@/components/provider-select";
import { VoiceButton, useVoiceButton } from "@/components/voice-button";
import { useSttCreditsPerMinute } from "@/components/voice-button/use-voice-pricing";
import {
  PLANNING_STAGES,
  PLAN_FILE_EXTENSIONS,
  aiPlanToSteps,
  streamAiPlan,
  suggestedPublishDate,
  validatePlanFiles,
  type AiPlanResult,
  type PlanEstimate,
  type PlanningStage,
} from "@/lib/content-planner/ai-plan";
import {
  fromDateTimeInputs,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/content-planner/dates";
import { planProductionSchedule } from "@/lib/content-planner/schedule";
import {
  plannedEventsFor,
  stepLook,
  stepName,
} from "@/lib/content-planner/steps";
import type { ContentEventType } from "@/lib/content-planner/types";
import { DEFAULT_REMINDER_MINUTES } from "@/lib/content-planner/reminders";
import { useContentPlannerStore } from "@/store/content-planner.store";
import { useCreditsStore } from "@/store/credits.store";
import { useToolsStore } from "@/store/tools.store";
import { lookStyle } from "./event-type-meta";
import { PlatformField, parsePlatformValue } from "./platform-field";
import type { PlanVideoInitial } from "./plan-video-dialog";
import { ToolActionCard } from "./tool-action-card";
import { useConflictToast } from "./use-conflict-toast";
import { useFormatDuration } from "./use-format-duration";

const WORK_START_MINUTES = 10 * 60;
const TITLE_MAX = 120;

interface AiPlannerDialogProps {
  open: boolean;
  onClose: () => void;
  /** After "Add to calendar": the first session, so the calendar can jump to it. */
  onPlanned: (firstSessionStart: Date) => void;
  /** "Review and edit": continue in "Plan a video" with the AI plan. */
  onReview: (initial: PlanVideoInitial) => void;
}

export function AiPlannerDialog(props: AiPlannerDialogProps) {
  if (!props.open) return null;
  return <AiPlannerForm {...props} />;
}

type Phase =
  | { name: "form" }
  | { name: "running"; stage: PlanningStage | null }
  | {
      name: "result";
      planId: string;
      plan: AiPlanResult;
      creditsCharged: number;
    };

function AiPlannerForm({
  onClose,
  onPlanned,
  onReview,
}: Omit<AiPlannerDialogProps, "open">) {
  const { t, locale, formatDate, formatNumber } = useI18n();
  const titleId = useId();
  const fileInputId = useId();
  const formatDuration = useFormatDuration();
  const showConflicts = useConflictToast();
  const builtinName = (type: ContentEventType) =>
    t(`contentPlanner.types.${type}`);

  const createProject = useContentPlannerStore((s) => s.createProject);
  const balance = useCreditsStore((s) => s.balance);
  const fetchBalance = useCreditsStore((s) => s.fetchBalance);
  const tools = useToolsStore((s) => s.tools);
  const fetchTools = useToolsStore((s) => s.fetchTools);
  const sttRate = useSttCreditsPerMinute();

  const [model, setModel] = useState("");
  const [modelName, setModelName] = useState("");
  const [idea, setIdea] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [platformValue, setPlatformValue] = useState("youtube-long");
  const [publishDate, setPublishDate] = useState("");
  const [estimate, setEstimate] = useState<PlanEstimate | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "form" });
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (tools.length === 0) void fetchTools();
  }, [tools.length, fetchTools]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Cost of a run with the selected model (credits set in Admin → AI Models).
  useEffect(() => {
    if (!model) return;
    let alive = true;
    api
      .get<{ data: PlanEstimate }>("/tools/content-planner/ai-plans/estimate", {
        params: { model },
      })
      .then((res) => alive && setEstimate(res.data))
      .catch(() => alive && setEstimate(null));
    return () => {
      alive = false;
    };
  }, [model]);

  // Voice: dictated text is appended to the idea (1 credit/min by default).
  const committed = useRef("");
  const voice = useVoiceButton({
    language: locale,
    onPartialTranscript: (text, isFinal) => {
      const base = committed.current ? `${committed.current} ` : "";
      if (isFinal) {
        committed.current = `${base}${text}`.trim();
        setIdea(committed.current);
      } else {
        setIdea(`${base}${text}`);
      }
    },
  });

  const addFiles = (incoming: File[]) => {
    const { accepted, rejected } = validatePlanFiles(files, incoming);
    setFiles((current) => [...current, ...accepted]);
    setFileErrors(
      rejected.map(({ file, problem }) =>
        t(`contentPlanner.ai.fileErrors.${problem}`, { name: file.name }),
      ),
    );
    setError(null);
  };

  const hasInput = idea.trim().length >= 10 || files.length > 0;
  const notEnoughCredits = estimate !== null && balance < estimate.total;

  const analyze = async () => {
    if (!hasInput) return setError(t("contentPlanner.ai.needInput"));
    if (!model) return;
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ name: "running", stage: null });
    const { platform } = parsePlatformValue(platformValue);
    const chosen = publishDate
      ? fromDateTimeInputs(publishDate, "18:00")
      : null;
    try {
      const done = await streamAiPlan(
        {
          model,
          idea,
          transcript: "",
          platform,
          publishDate: chosen?.toISOString(),
          language: locale,
          files,
        },
        (event) => {
          if (event.type === "stage")
            setPhase({ name: "running", stage: event.stage });
        },
        controller.signal,
      );
      setPhase({
        name: "result",
        planId: done.planId,
        plan: done.plan,
        creditsCharged: done.creditsCharged,
      });
      void fetchBalance();
    } catch (err) {
      if (controller.signal.aborted) return;
      setPhase({ name: "form" });
      setError(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.ai.failed",
        ),
      );
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase({ name: "form" });
  };

  // ── Result → calendar ─────────────────────────────────────────────
  const result = phase.name === "result" ? phase : null;
  const steps = useMemo(
    () =>
      result
        ? aiPlanToSteps(result.plan, (type) =>
            t(`contentPlanner.types.${type}`),
          )
        : [],
    [result, t],
  );
  const publishAt = useMemo(() => {
    if (!result) return null;
    // One work session per day before publishing day, starting tomorrow.
    const workSteps = result.plan.steps.filter((s) => !s.isPublish).length;
    return (
      (publishDate && fromDateTimeInputs(publishDate, "18:00")) ||
      suggestedPublishDate(
        Math.max(result.plan.suggestedPublishInDays, workSteps + 1),
        true,
      )
    );
  }, [result, publishDate]);
  const sessions = useMemo(
    () =>
      publishAt
        ? planProductionSchedule({
            publishAt,
            steps,
            workStartMinutes: WORK_START_MINUTES,
            skipWeekends: true,
          })
        : [],
    [publishAt, steps],
  );

  const hasPastSessions = sessions.some((s) => s.startAt < new Date());

  const sessionTitle = (videoTitle: string) => (step: (typeof steps)[number]) =>
    t("contentPlanner.plan.sessionTitle", {
      stage: stepName(step, builtinName),
      title: videoTitle,
    }).slice(0, TITLE_MAX);

  const addToCalendar = async () => {
    if (!result || !publishAt) return;
    setIsAdding(true);
    try {
      const { conflicts } = await createProject({
        title: result.plan.title,
        aiPlanId: result.planId,
        ...(platformValue.startsWith("custom:")
          ? parsePlatformValue(platformValue)
          : result.plan.platform
            ? { platform: result.plan.platform as never }
            : parsePlatformValue(platformValue)),
        publishAt: publishAt.toISOString(),
        events: plannedEventsFor(sessions, {
          sessionTitle: sessionTitle(result.plan.title),
          builtinName,
          reminderMinutes: DEFAULT_REMINDER_MINUTES,
        }),
      });
      toast.success(t("contentPlanner.ai.added", { title: result.plan.title }));
      showConflicts(conflicts);
      if (sessions[0]) onPlanned(sessions[0].startAt);
      onClose();
    } catch (err) {
      toast.error(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.plan.failed",
        ),
      );
    } finally {
      setIsAdding(false);
    }
  };

  const review = () => {
    if (!result || !publishAt) return;
    onReview({
      title: result.plan.title,
      platformValue: platformValue.startsWith("custom:")
        ? platformValue
        : (result.plan.platform ?? platformValue),
      publishDate: toDateInputValue(publishAt),
      publishTime: toTimeInputValue(publishAt),
      steps,
      aiPlanId: result.planId,
    });
  };

  const time = (d: Date) =>
    formatDate(d, { hour: "numeric", minute: "2-digit" });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        onClose={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-3xl border border-border"
      >
        <DialogHeader>
          <DialogTitle id={titleId} className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("contentPlanner.ai.title")}
          </DialogTitle>
          <DialogDescription>
            {t("contentPlanner.ai.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(var(--app-vvh,100dvh)-13rem)] sm:max-h-[70vh] space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {/* ── Form ── */}
          {phase.name === "form" && (
            <>
              <ProviderSelect
                toolModes={["text"]}
                value={model}
                label={t("contentPlanner.ai.model")}
                onChange={(id, option) => {
                  setModel(id);
                  setModelName(option.displayName);
                }}
              />

              <div className="space-y-2">
                <Textarea
                  label={t("contentPlanner.ai.idea")}
                  placeholder={t("contentPlanner.ai.ideaPlaceholder")}
                  value={idea}
                  rows={5}
                  maxLength={20_000}
                  onChange={(e) => {
                    setIdea(e.target.value);
                    committed.current = e.target.value;
                    setError(null);
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <VoiceButton
                    isListening={voice.isListening}
                    isSupported={voice.isSupported}
                    onToggle={() => void voice.toggleMic()}
                  />
                  <span className="text-xs text-text-dim">
                    {t("contentPlanner.ai.voiceCost", { count: sttRate })}
                  </span>
                </div>
              </div>

              {/* Files */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-muted">
                  {t("contentPlanner.ai.files")}
                </p>
                <label
                  htmlFor={fileInputId}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(Array.from(e.dataTransfer.files));
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/60",
                  )}
                >
                  <Upload className="h-5 w-5 text-text-dim" />
                  <span className="text-sm text-text">
                    {t("contentPlanner.ai.dropHere")}
                  </span>
                  <span className="text-xs text-text-dim">
                    {t("contentPlanner.ai.filesHint")}
                  </span>
                </label>
                <input
                  id={fileInputId}
                  type="file"
                  multiple
                  accept={PLAN_FILE_EXTENSIONS.join(",")}
                  className="sr-only"
                  data-testid="plan-files"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((file) => (
                      <li
                        key={file.name}
                        className="flex items-center gap-2 rounded-md bg-surface-elevated px-2.5 py-1.5 text-sm"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-text-dim" />
                        <span className="min-w-0 flex-1 truncate text-text">
                          {file.name}
                        </span>
                        <span className="text-xs text-text-dim">
                          {formatNumber(
                            Math.max(1, Math.round(file.size / 1024)),
                          )}{" "}
                          KB
                        </span>
                        <button
                          type="button"
                          aria-label={t("contentPlanner.ai.removeFile", {
                            name: file.name,
                          })}
                          onClick={() =>
                            setFiles((all) => all.filter((f) => f !== file))
                          }
                          className="rounded p-0.5 text-text-dim hover:text-error"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {fileErrors.map((message) => (
                  <p key={message} role="alert" className="text-xs text-error">
                    {message}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PlatformField
                  value={platformValue}
                  onChange={setPlatformValue}
                />
                <div>
                  <Input
                    type="date"
                    label={t("contentPlanner.ai.publishDate")}
                    value={publishDate}
                    min={toDateInputValue(new Date())}
                    onChange={(e) => setPublishDate(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-text-dim">
                    {t("contentPlanner.ai.publishDateHint")}
                  </p>
                </div>
              </div>

              {estimate && (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    notEnoughCredits
                      ? "border-error/40 bg-error-light text-error"
                      : "border-border bg-surface-elevated/60 text-text",
                  )}
                  data-testid="plan-cost"
                >
                  <p className="font-medium">
                    {t("contentPlanner.ai.cost", { total: estimate.total })}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t("contentPlanner.ai.costBreakdown", {
                      model: estimate.modelName,
                      modelCost: estimate.modelCost,
                      embeddingCost: estimate.embeddingCost,
                    })}{" "}
                    · {t("contentPlanner.ai.balance", { balance })}
                  </p>
                  {notEnoughCredits && (
                    <p className="mt-1 text-xs">
                      {t("contentPlanner.ai.notEnough")}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Progress ── */}
          {phase.name === "running" && (
            <ol
              className="space-y-2"
              aria-live="polite"
              data-testid="plan-progress"
            >
              {PLANNING_STAGES.map((stage) => {
                const current = phase.stage
                  ? PLANNING_STAGES.indexOf(phase.stage)
                  : -1;
                const index = PLANNING_STAGES.indexOf(stage);
                const status =
                  index < current
                    ? "done"
                    : index === current
                      ? "active"
                      : "todo";
                return (
                  <li
                    key={stage}
                    data-status={status}
                    className={cn(
                      "flex items-center gap-2 text-sm",
                      status === "todo" ? "text-text-dim" : "text-text",
                    )}
                  >
                    {status === "done" ? (
                      <Check className="h-4 w-4 text-secondary" />
                    ) : status === "active" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-border" />
                    )}
                    {t(`contentPlanner.ai.stages.${stage}`, {
                      model: modelName,
                    })}
                  </li>
                );
              })}
            </ol>
          )}

          {/* ── Result ── */}
          {result && (
            <div className="space-y-5" data-testid="plan-result">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-dim">
                  {t("contentPlanner.ai.resultTitle")}
                </p>
                <h3 className="text-lg font-semibold text-text">
                  {result.plan.title}
                </h3>
                {result.plan.summary && (
                  <p className="mt-1 text-sm text-text-muted">
                    {result.plan.summary}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 font-semibold",
                    result.plan.complexity.level === "high"
                      ? "bg-error-light text-error"
                      : result.plan.complexity.level === "medium"
                        ? "bg-warning-light text-warning"
                        : "bg-secondary-light text-secondary",
                  )}
                >
                  <Brain className="mr-1 inline h-3.5 w-3.5" />
                  {t(
                    `contentPlanner.ai.complexity.${result.plan.complexity.level}`,
                  )}{" "}
                  ·{" "}
                  {t("contentPlanner.ai.score", {
                    score: result.plan.complexity.score,
                  })}
                </span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                  {t("contentPlanner.plan.total", {
                    duration: formatDuration(result.plan.totalMinutes),
                  })}
                </span>
                <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-text-muted">
                  {t("contentPlanner.ai.sessions", {
                    count: result.plan.steps.length,
                  })}
                </span>
                <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-text-muted">
                  {t("contentPlanner.ai.timeframe", {
                    count: result.plan.suggestedPublishInDays,
                  })}
                </span>
                <span className="ml-auto text-text-dim">
                  {t("contentPlanner.ai.charged", {
                    count: result.creditsCharged,
                  })}
                </span>
              </div>
              {result.plan.complexity.rationale && (
                <p className="text-sm text-text-muted">
                  {result.plan.complexity.rationale}
                </p>
              )}

              {result.plan.similarProductions.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-text-muted">
                    {t("contentPlanner.ai.similarTitle")}
                    {result.plan.historyEstimateMinutes !== null && (
                      <>
                        {" · "}
                        {t("contentPlanner.ai.history", {
                          duration: formatDuration(
                            result.plan.historyEstimateMinutes,
                          ),
                        })}
                      </>
                    )}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {result.plan.similarProductions.map((s) => (
                      <li
                        key={s.projectId}
                        className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-text"
                      >
                        {s.title}{" "}
                        <span className="text-text-dim">
                          ({formatDuration(s.totalMinutes)},{" "}
                          {t("contentPlanner.ai.similarity", {
                            percent: Math.round(s.similarity * 100),
                          })}
                          )
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="mb-2 text-sm font-medium text-text-muted">
                  {t("contentPlanner.ai.stepsTitle")}
                </h4>
                <ol className="space-y-2">
                  {sessions.map(({ step, startAt, endAt }, i) => {
                    const style = lookStyle(stepLook(step));
                    const Icon = style.icon;
                    const aiStep = result.plan.steps[i];
                    return (
                      <li
                        key={step.key}
                        className="rounded-lg border border-border p-3"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-l-[3px]",
                              style.block,
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-medium text-text">
                              {stepName(step, builtinName)}
                              <span className="text-xs font-normal text-text-dim">
                                {formatDate(startAt, {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}{" "}
                                · {time(startAt)} – {time(endAt)} ·{" "}
                                {formatDuration(step.durationMinutes)}
                              </span>
                            </p>
                            {aiStep?.description && (
                              <p className="text-xs text-text-muted">
                                {aiStep.description}
                              </p>
                            )}
                            {aiStep?.toolAction && (
                              <ToolActionCard
                                className="mt-2"
                                action={aiStep.toolAction}
                                toolName={aiStep.toolAction.toolName}
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {hasPastSessions && (
                <p
                  role="status"
                  className="flex gap-2 rounded-lg bg-warning-light p-3 text-xs text-warning"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t("contentPlanner.plan.pastWarning")}
                </p>
              )}

              {publishAt && (
                <p className="text-xs text-text-dim">
                  {t("contentPlanner.ai.publishOn", {
                    date: formatDate(publishAt, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    }),
                  })}
                  {result.plan.sources.length > 0 && (
                    <>
                      {" · "}
                      {t("contentPlanner.ai.sources", {
                        names: result.plan.sources
                          .map((s) => s.name)
                          .join(", "),
                      })}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {phase.name === "form" && (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("contentPlanner.ai.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void analyze()}
                disabled={!model || notEnoughCredits}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {t("contentPlanner.ai.analyze")}
              </Button>
            </>
          )}
          {phase.name === "running" && (
            <Button type="button" variant="secondary" onClick={cancel}>
              {t("contentPlanner.ai.cancel")}
            </Button>
          )}
          {result && (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPhase({ name: "form" })}
              >
                {t("contentPlanner.ai.startOver")}
              </Button>
              <Button type="button" variant="secondary" onClick={review}>
                {t("contentPlanner.ai.reviewFirst")}
              </Button>
              <Button
                type="button"
                isLoading={isAdding}
                onClick={() => void addToCalendar()}
              >
                {t("contentPlanner.ai.addToCalendar")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
