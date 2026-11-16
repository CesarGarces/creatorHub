"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Button, Skeleton, cn } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import { useContentPlannerStore } from "@/store/content-planner.store";
import {
  addDays,
  addMinutes,
  startOfDay,
  visibleRange,
  type PlannerView,
} from "@/lib/content-planner/dates";
import type { ContentEvent } from "@/lib/content-planner/types";
import { WeekView } from "@/components/content-planner/week-view";
import { MonthView } from "@/components/content-planner/month-view";
import { AgendaView } from "@/components/content-planner/agenda-view";
import {
  EventDialog,
  type EventDialogTarget,
} from "@/components/content-planner/event-dialog";
import {
  PlanVideoDialog,
  type PlanVideoInitial,
} from "@/components/content-planner/plan-video-dialog";
import { AiPlannerDialog } from "@/components/content-planner/ai-planner-dialog";
import { ProjectsPanel } from "@/components/content-planner/projects-panel";
import { useConflictToast } from "@/components/content-planner/use-conflict-toast";
import { PlannerStats } from "@/components/content-planner/planner-stats";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";

const VIEWS: PlannerView[] = ["week", "month", "agenda"];
const DEFAULT_START_HOUR = 10;

// Phones open the planner on the agenda once per visit (see below).
let phoneAgendaApplied = false;

export default function ContentPlannerPage() {
  const { t, intlLocale, formatDate } = useI18n();
  const showConflicts = useConflictToast();

  const view = useContentPlannerStore((s) => s.view);
  const cursor = useContentPlannerStore((s) => s.cursor);
  const events = useContentPlannerStore((s) => s.events);
  const projects = useContentPlannerStore((s) => s.projects);
  const stats = useContentPlannerStore((s) => s.stats);
  const isLoading = useContentPlannerStore((s) => s.isLoadingEvents);
  const eventsError = useContentPlannerStore((s) => s.eventsError);
  const focusedProjectId = useContentPlannerStore((s) => s.focusedProjectId);
  const {
    setView,
    setCursor,
    goToday,
    shift,
    setFocusedProject,
    fetchEvents,
    fetchProjects,
    fetchStats,
    fetchCustomTypes,
    fetchCustomPlatforms,
    fetchProductionSteps,
    updateEvent,
  } = useContentPlannerStore.getState();

  const [dialogTarget, setDialogTarget] = useState<EventDialogTarget | null>(
    null,
  );
  const [planOpen, setPlanOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // An AI plan continued in "Plan a video" ("Review and edit").
  const [planInitial, setPlanInitial] = useState<PlanVideoInitial | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const range = useMemo(() => visibleRange(view, cursor), [view, cursor]);
  const rangeKey = `${range.from.getTime()}-${range.to.getTime()}`;

  useEffect(() => {
    void fetchEvents().then(() => setHasLoadedOnce(true));
    // Refetch only when the visible window changes.
  }, [rangeKey, fetchEvents]);

  useEffect(() => {
    void fetchProjects();
    void fetchStats();
    void fetchCustomTypes();
    // Ready before "Plan a video" opens.
    void fetchCustomPlatforms();
    void fetchProductionSteps();
  }, [
    fetchProjects,
    fetchStats,
    fetchCustomTypes,
    fetchCustomPlatforms,
    fetchProductionSteps,
  ]);

  // Presentation only: on phones the agenda (sessions in date order) is the
  // most usable view, so it is shown first — once per visit, so the user's
  // own choice sticks. Declared before the deep link below, which wins.
  const isPhone = useMediaQuery(PHONE_QUERY);
  useEffect(() => {
    if (!isPhone || phoneAgendaApplied) return;
    phoneAgendaApplied = true;
    setView("agenda");
  }, [isPhone, setView]);

  // "Open in planner" from a reminder: /tools/content-planner?date=<ISO>.
  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("date");
    if (!date) return;
    const target = new Date(date);
    if (!Number.isNaN(target.getTime())) {
      setCursor(target);
      setView("week");
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [setCursor, setView]);

  const focusedProject = projects.find((p) => p.id === focusedProjectId);

  const rangeLabel = useMemo(() => {
    if (view === "month") {
      return formatDate(cursor, { month: "long", year: "numeric" });
    }
    const last = addDays(range.to, -1);
    const format = new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return format.formatRange(range.from, last);
  }, [view, cursor, range, intlLocale, formatDate]);

  // ─── Actions ───────────────────────────────────────────────────────────
  const openCreate = useCallback(
    (start?: Date) => {
      if (start) return setDialogTarget({ mode: "create", start });
      // Next full hour if "now" is on screen, otherwise the first visible day.
      const now = new Date();
      const inView = now >= range.from && now < range.to;
      const defaultStart = inView
        ? new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours() + 1,
          )
        : addMinutes(startOfDay(range.from), DEFAULT_START_HOUR * 60);
      setDialogTarget({ mode: "create", start: defaultStart });
    },
    [range],
  );

  const saveQuietly = useCallback(
    async (
      event: ContentEvent,
      patch: Parameters<typeof updateEvent>[1],
      successMessage?: string,
    ) => {
      try {
        const conflicts = await updateEvent(event.id, patch);
        if (successMessage) toast.success(successMessage);
        showConflicts(conflicts);
      } catch (err) {
        toast.error(
          localizeError(
            err instanceof Error ? err.message : undefined,
            "contentPlanner.event.saveFailed",
          ),
        );
      }
    },
    [updateEvent, showConflicts],
  );

  const handleMove = (event: ContentEvent, start: Date) => {
    const duration =
      new Date(event.endAt).getTime() - new Date(event.startAt).getTime();
    void saveQuietly(
      event,
      {
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + duration).toISOString(),
      },
      t("contentPlanner.event.rescheduled", {
        date: formatDate(start, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      }),
    );
  };

  // Resizing from the week grid: saved once, when the edge is released.
  const handleResize = (event: ContentEvent, start: Date, end: Date) => {
    const time = (d: Date) =>
      formatDate(d, { hour: "numeric", minute: "2-digit" });
    void saveQuietly(
      event,
      { startAt: start.toISOString(), endAt: end.toISOString() },
      t("contentPlanner.event.resized", {
        range: `${time(start)} – ${time(end)}`,
      }),
    );
  };

  const handleToggleDone = (event: ContentEvent) => {
    void saveQuietly(event, {
      status: event.status === "DONE" ? "PLANNED" : "DONE",
    });
  };

  const goToDate = (date: Date) => {
    setCursor(date);
    if (view === "agenda") setView("week");
  };

  const showLoadingSkeleton = isLoading && !hasLoadedOnce;

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.tools"), href: "/tools" },
          { label: t("contentPlanner.title") },
        ]}
      />

      <div className="space-y-4 p-4 sm:space-y-5 sm:p-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              {t("contentPlanner.title")}
            </h1>
            <p className="mt-1 text-text-muted">
              {t("contentPlanner.subtitle")}
            </p>
          </div>
          {/* Phones: the AI planner (primary) first and full width, then the
              two manual actions side by side. */}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button
              variant="secondary"
              className="pointer-coarse:h-11 max-sm:px-2"
              onClick={() => openCreate()}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              {t("contentPlanner.actions.newSession")}
            </Button>
            <Button
              variant="secondary"
              className="pointer-coarse:h-11 max-sm:px-2"
              onClick={() => {
                setPlanInitial(null);
                setPlanOpen(true);
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t("contentPlanner.actions.planVideo")}
            </Button>
            <Button
              className="col-span-2 -order-1 pointer-coarse:h-11 sm:order-none"
              onClick={() => setAiOpen(true)}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {t("contentPlanner.ai.button")}
            </Button>
          </div>
        </div>

        {/* Totals over the whole calendar (refreshed after every change) */}
        <PlannerStats stats={stats} />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11"
              aria-label={t("contentPlanner.actions.previous")}
              onClick={() => shift(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 pointer-coarse:h-11"
              onClick={goToday}
            >
              {t("contentPlanner.actions.today")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11"
              aria-label={t("contentPlanner.actions.next")}
              onClick={() => shift(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2
              className="ml-1 text-base font-semibold capitalize text-text sm:ml-2 sm:text-lg"
              aria-live="polite"
            >
              {rangeLabel}
            </h2>
          </div>

          <div
            role="tablist"
            aria-label={t("contentPlanner.views.label")}
            className="flex w-full rounded-lg border border-border bg-surface p-0.5 sm:w-auto"
          >
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 pointer-coarse:py-2.5 text-sm font-medium transition-colors sm:flex-none",
                  view === v
                    ? "bg-primary text-white"
                    : "text-text-muted hover:text-text",
                )}
              >
                {t(`contentPlanner.views.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {focusedProject && (
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
              {focusedProject.title}
              <button
                type="button"
                onClick={() => setFocusedProject(null)}
                aria-label={t("contentPlanner.projects.clearFocus")}
                className="rounded-full hover:bg-primary/20 pointer-coarse:p-1.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-2">
            {eventsError ? (
              <div className="rounded-xl border border-error/40 bg-error-light p-6 text-center">
                <p className="text-sm text-error">
                  {t("contentPlanner.calendar.loadFailed")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void fetchEvents()}
                >
                  {t("contentPlanner.calendar.retry")}
                </Button>
              </div>
            ) : showLoadingSkeleton ? (
              <Skeleton className="h-[600px] rounded-xl" />
            ) : view === "week" ? (
              <WeekView
                cursor={cursor}
                events={events}
                focusedProjectId={focusedProjectId}
                onSelectEvent={(event) =>
                  setDialogTarget({ mode: "edit", event })
                }
                onCreateAt={openCreate}
                onMoveEvent={handleMove}
                onResizeEvent={handleResize}
              />
            ) : view === "month" ? (
              <MonthView
                cursor={cursor}
                events={events}
                focusedProjectId={focusedProjectId}
                onSelectEvent={(event) =>
                  setDialogTarget({ mode: "edit", event })
                }
                onCreateOnDay={(day) =>
                  openCreate(addMinutes(day, DEFAULT_START_HOUR * 60))
                }
                onShowDay={(day) => {
                  setCursor(day);
                  setView("week");
                }}
              />
            ) : (
              <AgendaView
                events={events}
                focusedProjectId={focusedProjectId}
                onSelectEvent={(event) =>
                  setDialogTarget({ mode: "edit", event })
                }
                onToggleDone={handleToggleDone}
                onPlanVideo={() => setPlanOpen(true)}
              />
            )}
            {view === "week" && !eventsError && (
              <p className="hidden text-xs text-text-dim pointer-fine:block">
                {t("contentPlanner.calendar.dragHint")}
              </p>
            )}
          </div>

          <ProjectsPanel
            projects={projects}
            focusedProjectId={focusedProjectId}
            onToggleFocus={(id) =>
              setFocusedProject(focusedProjectId === id ? null : id)
            }
            onGoToDate={goToDate}
          />
        </div>
      </div>

      <EventDialog
        target={dialogTarget}
        projects={projects}
        onClose={() => setDialogTarget(null)}
      />
      <PlanVideoDialog
        open={planOpen}
        initial={planInitial}
        onClose={() => {
          setPlanOpen(false);
          setPlanInitial(null);
        }}
        onPlanned={(firstStart) => setCursor(firstStart)}
      />
      <AiPlannerDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onPlanned={(firstStart) => setCursor(firstStart)}
        onReview={(initial) => {
          setAiOpen(false);
          setPlanInitial(initial);
          setPlanOpen(true);
        }}
      />
    </>
  );
}
