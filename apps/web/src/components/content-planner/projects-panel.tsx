"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Trash2 } from "lucide-react";
import { ActionConfirmDialog, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import type { ContentProject } from "@/lib/content-planner/types";
import { useContentPlannerStore } from "@/store/content-planner.store";
import { eventStyle } from "./event-type-meta";
import { useTypeLabel } from "./use-type-label";

interface ProjectsPanelProps {
  projects: ContentProject[];
  focusedProjectId: string | null;
  onToggleFocus: (projectId: string) => void;
  onGoToDate: (date: Date) => void;
}

export function ProjectsPanel({
  projects,
  focusedProjectId,
  onToggleFocus,
  onGoToDate,
}: ProjectsPanelProps) {
  const { t, tOptional, formatDate } = useI18n();
  const typeLabel = useTypeLabel();
  const deleteProject = useContentPlannerStore((s) => s.deleteProject);
  const [toDelete, setToDelete] = useState<ContentProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(toDelete.id);
      toast.success(t("contentPlanner.projects.deleted"));
      setToDelete(null);
    } catch (err) {
      toast.error(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.projects.deleteFailed",
        ),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const shortDate = (iso: string) =>
    formatDate(iso, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <aside className="rounded-xl border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-text">
        {t("contentPlanner.projects.title")}
      </h2>

      {projects.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-text-muted">
            {t("contentPlanner.projects.empty")}
          </p>
          <p className="mt-1 text-xs text-text-dim">
            {t("contentPlanner.projects.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border lg:max-h-[60vh] lg:overflow-y-auto lg:overscroll-contain">
          {projects.map((project) => {
            const { done, total } = project.progress;
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;
            const focused = focusedProjectId === project.id;
            const next = project.nextEvent;
            return (
              <li
                key={project.id}
                className={cn(
                  "group px-4 py-3 transition-colors",
                  focused && "bg-primary/5",
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleFocus(project.id)}
                    aria-pressed={focused}
                    title={t(
                      focused
                        ? "contentPlanner.projects.clearFocus"
                        : "contentPlanner.projects.focus",
                    )}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      title={project.title}
                      className={cn(
                        "truncate text-sm font-medium",
                        focused ? "text-primary" : "text-text",
                      )}
                    >
                      {project.title}
                    </p>
                    <p className="truncate text-xs text-text-dim">
                      {project.customPlatform
                        ? `${project.customPlatform.name} · `
                        : project.platform &&
                          `${tOptional(
                            `contentPlanner.platforms.${project.platform}`,
                            project.platform,
                          )} · `}
                      {project.publishAt
                        ? t("contentPlanner.projects.publishOn", {
                            date: shortDate(project.publishAt),
                          })
                        : t("contentPlanner.projects.noDate")}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-0.5 opacity-70 group-hover:opacity-100">
                    {project.publishAt && (
                      <IconButton
                        label={t("contentPlanner.projects.goToPublish")}
                        onClick={() => onGoToDate(new Date(project.publishAt!))}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                    <IconButton
                      label={t("contentPlanner.projects.delete")}
                      onClick={() => setToDelete(project)}
                      className="hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </div>

                {total > 0 && (
                  <div className="mt-2">
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-elevated"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={done}
                      aria-label={t("contentPlanner.projects.progress", {
                        done,
                        total,
                      })}
                    >
                      <div
                        className="h-full rounded-full bg-secondary transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-text-dim">
                      <span className="truncate">
                        {next
                          ? t("contentPlanner.projects.next", {
                              title: typeLabel(next),
                            })
                          : done === total
                            ? t("contentPlanner.projects.nothingPending")
                            : null}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {t("contentPlanner.projects.progress", { done, total })}
                      </span>
                    </div>
                    {next && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            eventStyle(next).dot,
                          )}
                        />
                        <span className="truncate">
                          {shortDate(next.startAt)}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ActionConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title={t("contentPlanner.projects.confirmDelete")}
        description={t("contentPlanner.projects.confirmDeleteDescription", {
          title: toDelete?.title ?? "",
        })}
        confirmLabel={t("contentPlanner.projects.delete")}
        cancelLabel={t("contentPlanner.event.cancel")}
      />
    </aside>
  );
}

function IconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 pointer-coarse:h-10 pointer-coarse:w-10 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-surface-elevated hover:text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}
