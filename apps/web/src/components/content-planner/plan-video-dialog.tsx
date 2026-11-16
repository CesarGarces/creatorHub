"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Clock } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  cn,
} from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import {
  addDays,
  fromDateTimeInputs,
  startOfDay,
  timeInputToMinutes,
  toDateInputValue,
} from "@/lib/content-planner/dates";
import { planProductionSchedule } from "@/lib/content-planner/schedule";
import {
  defaultSteps,
  duplicateStepName,
  fromSaved,
  plannedEventsFor,
  stepLook,
  stepName,
  toSaved,
  totalMinutes,
  type ProductionStep,
} from "@/lib/content-planner/steps";
import type { ContentEventType } from "@/lib/content-planner/types";
import { useContentPlannerStore } from "@/store/content-planner.store";
import { lookStyle } from "./event-type-meta";
import { PlatformField, parsePlatformValue } from "./platform-field";
import { StepsEditor } from "./steps-editor";
import { useConflictToast } from "./use-conflict-toast";
import { useFormatDuration } from "./use-format-duration";
import { ReminderSelect } from "./reminder-select";
import {
  DEFAULT_REMINDER_MINUTES,
  reminderToValue,
  valueToReminder,
} from "@/lib/content-planner/reminders";

const TITLE_MAX = 120;

/** Pre-filled values, e.g. from the AI planning assistant ("Review and edit"). */
export interface PlanVideoInitial {
  title: string;
  platformValue?: string;
  /** "YYYY-MM-DD" and "HH:mm". */
  publishDate?: string;
  publishTime?: string;
  steps: ProductionStep[];
  /** Links the created project to the AI plan it comes from. */
  aiPlanId?: string;
}

interface PlanVideoDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the first planned session so the calendar can jump to it. */
  onPlanned: (firstSessionStart: Date) => void;
  initial?: PlanVideoInitial | null;
}

export function PlanVideoDialog({
  open,
  onClose,
  onPlanned,
  initial,
}: PlanVideoDialogProps) {
  if (!open) return null;
  return (
    <PlanVideoForm onClose={onClose} onPlanned={onPlanned} initial={initial} />
  );
}

function PlanVideoForm({
  onClose,
  onPlanned,
  initial,
}: Omit<PlanVideoDialogProps, "open">) {
  const { t, formatDate } = useI18n();
  const titleId = useId();
  const createProject = useContentPlannerStore((s) => s.createProject);
  const savedSteps = useContentPlannerStore((s) => s.productionSteps);
  const fetchProductionSteps = useContentPlannerStore(
    (s) => s.fetchProductionSteps,
  );
  const fetchCustomPlatforms = useContentPlannerStore(
    (s) => s.fetchCustomPlatforms,
  );
  const saveProductionSteps = useContentPlannerStore(
    (s) => s.saveProductionSteps,
  );
  const showConflicts = useConflictToast();
  const formatDuration = useFormatDuration();
  const builtinName = (type: ContentEventType) =>
    t(`contentPlanner.types.${type}`);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [platformValue, setPlatformValue] = useState(
    initial?.platformValue ?? "youtube-long",
  );
  // Default: one week from today at 18:00 — enough room for every step.
  const [publishDate, setPublishDate] = useState(
    () => initial?.publishDate ?? toDateInputValue(addDays(new Date(), 7)),
  );
  const [publishTime, setPublishTime] = useState(
    initial?.publishTime ?? "18:00",
  );
  const [workStart, setWorkStart] = useState("10:00");
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [reminder, setReminder] = useState(() =>
    reminderToValue(DEFAULT_REMINDER_MINUTES),
  );
  const [steps, setSteps] = useState<ProductionStep[]>(
    () =>
      initial?.steps ??
      (savedSteps?.length ? fromSaved(savedSteps) : defaultSteps()),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load the user's saved steps; adopt them unless the list was already edited.
  // (An AI plan's steps are never replaced by the template.)
  const stepsTouched = useRef(Boolean(initial));
  useEffect(() => {
    void fetchProductionSteps();
    void fetchCustomPlatforms();
  }, [fetchProductionSteps, fetchCustomPlatforms]);
  useEffect(() => {
    if (!stepsTouched.current && savedSteps?.length) {
      setSteps(fromSaved(savedSteps));
    }
  }, [savedSteps]);

  const changeSteps = (next: ProductionStep[]) => {
    stepsTouched.current = true;
    setSteps(next);
    setError(null);
  };

  const publishAt = fromDateTimeInputs(publishDate, publishTime);
  const workStartMinutes = timeInputToMinutes(workStart);

  // Recomputed on every change: dates, durations, order, enabled steps.
  const plan = useMemo(() => {
    const at = fromDateTimeInputs(publishDate, publishTime);
    if (!at || workStartMinutes === null) return [];
    return planProductionSchedule({
      publishAt: at,
      steps,
      workStartMinutes,
      skipWeekends,
    });
  }, [publishDate, publishTime, steps, workStartMinutes, skipWeekends]);
  const hasPastSessions = plan.some((s) => s.startAt < new Date());
  const total = totalMinutes(steps);

  const sessionTitle = (step: ProductionStep, videoTitle: string) =>
    t("contentPlanner.plan.sessionTitle", {
      stage: stepName(step, builtinName),
      title: videoTitle,
    }).slice(0, TITLE_MAX);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoTitle = title.trim();
    if (!videoTitle)
      return setError(t("contentPlanner.plan.errors.titleRequired"));
    if (!publishAt || workStartMinutes === null) {
      return setError(t("contentPlanner.plan.errors.invalidDate"));
    }
    if (plan.length === 0)
      return setError(t("contentPlanner.plan.errors.noStages"));
    if (steps.some((s) => !stepName(s, builtinName).trim())) {
      return setError(t("contentPlanner.plan.steps.errors.nameRequired"));
    }
    const duplicate = duplicateStepName(steps, builtinName);
    if (duplicate) {
      return setError(
        t("contentPlanner.plan.steps.errors.duplicate", { name: duplicate }),
      );
    }

    setIsSaving(true);
    try {
      const { conflicts } = await createProject({
        title: videoTitle,
        ...(initial?.aiPlanId ? { aiPlanId: initial.aiPlanId } : {}),
        ...parsePlatformValue(platformValue),
        publishAt: publishAt.toISOString(),
        events: plannedEventsFor(plan, {
          sessionTitle: (step) => sessionTitle(step, videoTitle),
          builtinName,
          reminderMinutes: valueToReminder(reminder),
        }),
      });
      toast.success(
        t("contentPlanner.plan.created", {
          title: videoTitle,
          count: plan.length,
        }),
      );
      showConflicts(conflicts);
      // Remember these steps for the next video (not critical if it fails).
      // An AI plan is specific to its video: it doesn't become the template.
      if (!initial?.aiPlanId) {
        try {
          await saveProductionSteps(toSaved(steps));
        } catch {
          toast.warning(t("contentPlanner.plan.steps.notSaved"));
        }
      }
      if (plan[0]) onPlanned(plan[0].startAt);
      onClose();
    } catch (err) {
      setError(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.plan.failed",
        ),
      );
    } finally {
      setIsSaving(false);
    }
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
        className="w-full max-w-4xl border border-border"
      >
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle id={titleId}>
              {t("contentPlanner.plan.title")}
            </DialogTitle>
            <DialogDescription>
              {t("contentPlanner.plan.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[70vh] gap-6 overflow-y-auto p-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {/* Settings */}
            <div className="space-y-4">
              <Input
                label={t("contentPlanner.plan.videoTitle")}
                placeholder={t("contentPlanner.plan.videoTitlePlaceholder")}
                value={title}
                maxLength={TITLE_MAX}
                autoFocus
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
              />
              <PlatformField
                value={platformValue}
                onChange={setPlatformValue}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="date"
                  label={t("contentPlanner.plan.publishDate")}
                  value={publishDate}
                  min={toDateInputValue(startOfDay(new Date()))}
                  onChange={(e) => setPublishDate(e.target.value)}
                />
                <Input
                  type="time"
                  label={t("contentPlanner.plan.publishTime")}
                  value={publishTime}
                  onChange={(e) => setPublishTime(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 items-end gap-4">
                <Input
                  type="time"
                  label={t("contentPlanner.plan.workStart")}
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                />
                <label className="flex h-[42px] items-center gap-3 text-sm text-text-muted">
                  <Switch
                    checked={skipWeekends}
                    onCheckedChange={setSkipWeekends}
                  />
                  {t("contentPlanner.plan.skipWeekends")}
                </label>
              </div>

              <ReminderSelect
                label={t("contentPlanner.reminders.planLabel")}
                value={reminder}
                onChange={setReminder}
              />

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-text-muted">
                  {t("contentPlanner.plan.stages")}
                </legend>
                <StepsEditor
                  steps={steps}
                  onChange={changeSteps}
                  onReset={() => changeSteps(defaultSteps())}
                />
              </fieldset>
            </div>

            {/* Preview */}
            <div>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-text-muted">
                  {t("contentPlanner.plan.preview")}
                </h3>
                <p
                  data-testid="plan-total"
                  aria-live="polite"
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {t("contentPlanner.plan.total", {
                    duration: formatDuration(total),
                  })}
                </p>
              </div>
              {plan.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-text-dim">
                  {t("contentPlanner.plan.previewEmpty")}
                </p>
              ) : (
                <ol
                  aria-label={t("contentPlanner.plan.preview")}
                  className="relative space-y-3 border-l border-border pl-5"
                >
                  {plan.map(({ step, startAt, endAt }) => {
                    const style = lookStyle(stepLook(step));
                    const Icon = style.icon;
                    const past = startAt < new Date();
                    const name = stepName(step, builtinName);
                    return (
                      <li key={step.key} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[27px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-surface",
                            style.dot,
                          )}
                        />
                        <p
                          className={cn(
                            "text-xs",
                            past ? "text-warning" : "text-text-dim",
                          )}
                        >
                          {formatDate(startAt, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          · {time(startAt)} – {time(endAt)} ·{" "}
                          {formatDuration(step.durationMinutes)}
                        </p>
                        <p className="flex items-center gap-1.5 text-sm text-text">
                          <Icon className="h-3.5 w-3.5 text-text-muted" />
                          {title.trim()
                            ? sessionTitle(step, title.trim())
                            : name}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
              {hasPastSessions && (
                <p className="mt-4 flex gap-2 rounded-lg bg-warning-light p-3 text-xs text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {t("contentPlanner.plan.pastWarning")}
                </p>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="px-6 pb-4 text-sm text-error">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("contentPlanner.event.cancel")}
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {t("contentPlanner.plan.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
