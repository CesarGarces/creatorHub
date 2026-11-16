"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  ActionConfirmDialog,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import {
  addDays,
  addMinutes,
  fromDateTimeInputs,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/content-planner/dates";
import {
  CONTENT_EVENT_STATUSES,
  type ContentEvent,
  type ContentEventStatus,
  type ContentProject,
} from "@/lib/content-planner/types";
import { useContentPlannerStore } from "@/store/content-planner.store";
import { SelectField } from "./select-field";
import { TypeField, customTypeValue, parseTypeValue } from "./type-field";
import { useConflictToast } from "./use-conflict-toast";
import { ReminderSelect } from "./reminder-select";
import { ToolActionCard } from "./tool-action-card";
import {
  DEFAULT_REMINDER_MINUTES,
  reminderToValue,
  valueToReminder,
} from "@/lib/content-planner/reminders";

/** What the dialog edits: an existing session, or a new one at `start`. */
export type EventDialogTarget =
  | { mode: "edit"; event: ContentEvent }
  | { mode: "create"; start: Date };

interface EventDialogProps {
  target: EventDialogTarget | null;
  projects: ContentProject[];
  onClose: () => void;
}

export function EventDialog({ target, projects, onClose }: EventDialogProps) {
  if (!target) return null;
  // Remount per target so the form starts from fresh values.
  const key =
    target.mode === "edit" ? target.event.id : target.start.toISOString();
  return (
    <EventDialogForm
      key={key}
      target={target}
      projects={projects}
      onClose={onClose}
    />
  );
}

interface FormState {
  title: string;
  /** Select value: a built-in type, or `custom:<id>` (see TypeField). */
  typeValue: string;
  status: ContentEventStatus;
  date: string;
  startTime: string;
  endTime: string;
  projectId: string;
  notes: string;
  /** Reminder select value: "none" or minutes before ("15"). */
  reminder: string;
}

function initialState(target: EventDialogTarget): FormState {
  if (target.mode === "edit") {
    const { event } = target;
    const start = new Date(event.startAt);
    return {
      title: event.title,
      typeValue: event.customTypeId
        ? customTypeValue(event.customTypeId)
        : event.type,
      status: event.status,
      date: toDateInputValue(start),
      startTime: toTimeInputValue(start),
      endTime: toTimeInputValue(new Date(event.endAt)),
      projectId: event.projectId ?? "",
      // Sessions from before reminders existed behave like the default.
      reminder: reminderToValue(
        event.reminderMinutes === undefined
          ? DEFAULT_REMINDER_MINUTES
          : event.reminderMinutes,
      ),
      notes: event.notes ?? "",
    };
  }
  return {
    title: "",
    typeValue: "RECORDING",
    status: "PLANNED",
    date: toDateInputValue(target.start),
    startTime: toTimeInputValue(target.start),
    endTime: toTimeInputValue(addMinutes(target.start, 60)),
    projectId: "",
    reminder: reminderToValue(DEFAULT_REMINDER_MINUTES),
    notes: "",
  };
}

/**
 * Start/end from the form. An end time earlier than the start time means
 * the session ends the next day (e.g. a 22:00 – 01:00 livestream).
 */
function resolveTimes(form: FormState) {
  const start = fromDateTimeInputs(form.date, form.startTime);
  let end = fromDateTimeInputs(form.date, form.endTime);
  if (!start || !end) return null;
  const nextDay = end < start;
  if (nextDay) end = addDays(end, 1);
  return { start, end, nextDay };
}

function EventDialogForm({
  target,
  projects,
  onClose,
}: {
  target: EventDialogTarget;
  projects: ContentProject[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const createEvent = useContentPlannerStore((s) => s.createEvent);
  const updateEvent = useContentPlannerStore((s) => s.updateEvent);
  const deleteEvent = useContentPlannerStore((s) => s.deleteEvent);
  const showConflicts = useConflictToast();

  const [form, setForm] = useState<FormState>(() => initialState(target));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEdit = target.mode === "edit";
  const times = resolveTimes(form);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return setError(t("contentPlanner.event.errors.titleRequired"));
    if (!times) return setError(t("contentPlanner.event.errors.invalidTime"));
    if (times.end.getTime() === times.start.getTime()) {
      return setError(t("contentPlanner.event.errors.endBeforeStart"));
    }

    setIsSaving(true);
    try {
      const { type, customTypeId } = parseTypeValue(form.typeValue);
      const common = {
        title,
        type,
        startAt: times.start.toISOString(),
        endAt: times.end.toISOString(),
      };
      const conflicts =
        target.mode === "edit"
          ? await updateEvent(target.event.id, {
              ...common,
              status: form.status,
              notes: form.notes.trim() || null,
              projectId: form.projectId || null,
              customTypeId,
              reminderMinutes: valueToReminder(form.reminder),
            })
          : await createEvent({
              ...common,
              ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
              ...(form.projectId ? { projectId: form.projectId } : {}),
              ...(customTypeId ? { customTypeId } : {}),
              reminderMinutes: valueToReminder(form.reminder),
            });
      toast.success(
        t(
          isEdit
            ? "contentPlanner.event.updated"
            : "contentPlanner.event.created",
        ),
      );
      showConflicts(conflicts);
      onClose();
    } catch (err) {
      setError(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.event.saveFailed",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (target.mode !== "edit") return;
    setIsDeleting(true);
    try {
      await deleteEvent(target.event.id);
      toast.success(t("contentPlanner.event.deleted"));
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.event.deleteFailed",
        ),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onClose={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg border border-border"
      >
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle id={titleId}>
              {t(
                isEdit
                  ? "contentPlanner.event.editTitle"
                  : "contentPlanner.event.createTitle",
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
            <Input
              label={t("contentPlanner.event.title")}
              placeholder={t("contentPlanner.event.titlePlaceholder")}
              value={form.title}
              maxLength={120}
              autoFocus
              onChange={(e) => patch("title", e.target.value)}
            />

            <div className="grid items-start gap-4 sm:grid-cols-2">
              <TypeField
                value={form.typeValue}
                onChange={(v) => patch("typeValue", v)}
              />
              {isEdit ? (
                <SelectField
                  label={t("contentPlanner.event.status")}
                  value={form.status}
                  onChange={(e) =>
                    patch("status", e.target.value as ContentEventStatus)
                  }
                  options={CONTENT_EVENT_STATUSES.map((status) => ({
                    value: status,
                    label: t(`contentPlanner.statuses.${status}`),
                  }))}
                />
              ) : (
                <ProjectSelect
                  projects={projects}
                  value={form.projectId}
                  onChange={(v) => patch("projectId", v)}
                />
              )}
            </div>

            <div className="grid gap-4 grid-cols-[1.4fr_1fr_1fr]">
              <Input
                type="date"
                label={t("contentPlanner.event.date")}
                value={form.date}
                onChange={(e) => patch("date", e.target.value)}
              />
              <Input
                type="time"
                label={t("contentPlanner.event.start")}
                value={form.startTime}
                onChange={(e) => patch("startTime", e.target.value)}
              />
              <Input
                type="time"
                label={t("contentPlanner.event.end")}
                value={form.endTime}
                onChange={(e) => patch("endTime", e.target.value)}
              />
            </div>
            {times?.nextDay && (
              <p className="-mt-2 text-xs text-text-muted">
                {t("contentPlanner.event.nextDay")}
              </p>
            )}

            {isEdit && (
              <ProjectSelect
                projects={projects}
                value={form.projectId}
                onChange={(v) => patch("projectId", v)}
              />
            )}

            {target.mode === "edit" && target.event.toolAction && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-text-muted">
                  {t("contentPlanner.ai.suggestedTool")}
                </p>
                <ToolActionCard action={target.event.toolAction} />
              </div>
            )}

            <ReminderSelect
              label={t("contentPlanner.reminders.label")}
              value={form.reminder}
              onChange={(v) => patch("reminder", v)}
            />

            <Textarea
              label={t("contentPlanner.event.notes")}
              placeholder={t("contentPlanner.event.notesPlaceholder")}
              value={form.notes}
              rows={3}
              maxLength={5000}
              onChange={(e) => patch("notes", e.target.value)}
            />

            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:items-center">
            {isEdit && (
              <Button
                type="button"
                variant="ghost"
                className="sm:mr-auto text-error hover:text-error"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {t("contentPlanner.event.delete")}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("contentPlanner.event.cancel")}
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {t(
                isEdit
                  ? "contentPlanner.event.save"
                  : "contentPlanner.event.create",
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <ActionConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title={t("contentPlanner.event.confirmDelete")}
        description={t("contentPlanner.event.confirmDeleteDescription", {
          title:
            form.title || (target.mode === "edit" ? target.event.title : ""),
        })}
        confirmLabel={t("contentPlanner.event.delete")}
        cancelLabel={t("contentPlanner.event.cancel")}
      />
    </Dialog>
  );
}

function ProjectSelect({
  projects,
  value,
  onChange,
}: {
  projects: ContentProject[];
  value: string;
  onChange: (projectId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <SelectField
      label={t("contentPlanner.event.project")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: "", label: t("contentPlanner.event.noProject") },
        ...projects.map((p) => ({ value: p.id, label: p.title })),
      ]}
    />
  );
}
