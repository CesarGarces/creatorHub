"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ToolManifest } from "@creator-hub/shared-types";
import { EmptyState, ToolCard, cn } from "@creator-hub/ui";
import { useToolsStore } from "@/store/tools.store";
import { useFavoritesStore } from "@/store/favorites.store";
import { useI18n } from "@/i18n/i18n-provider";
import { useToolText } from "@/i18n/use-tool-text";
import { NO_WIDGET_DRAG } from "@/lib/dashboard-widgets/drag";
import { WidgetSkeleton } from "../widget-skeleton";
import { WidgetHeader } from "../widget-header";

/**
 * Favorite tools (drag a card's handle to reorder them), or quick access to
 * the first four tools when there are no favorites yet.
 */
export function FavoritesWidget() {
  const router = useRouter();
  const { t } = useI18n();
  const { toolName, toolDescription, categoryLabel } = useToolText();
  const { tools, fetchTools } = useToolsStore();
  const { favoriteIds, fetchFavorites, toggleFavorite, reorderFavorites } =
    useFavoritesStore();

  // Until the tools and the favorites have both loaded, placeholders of the
  // cards' size hold the grid — no empty state or "first tools → favorites"
  // swap flashing, and no jump below.
  const [settled, setSettled] = useState(tools.length > 0);

  useEffect(() => {
    void Promise.allSettled([fetchTools(), fetchFavorites()]).then(() =>
      setSettled(true),
    );
  }, [fetchTools, fetchFavorites]);

  const favoriteTools = useMemo(
    () =>
      favoriteIds
        .map((id) => tools.find((tool) => tool.id === id))
        .filter((tool): tool is ToolManifest => tool !== undefined),
    [tools, favoriteIds],
  );
  const shownTools =
    favoriteTools.length > 0 ? favoriteTools : tools.slice(0, 4);
  const isDraggable = favoriteTools.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = favoriteIds.indexOf(active.id as string);
    const newIndex = favoriteIds.indexOf(over.id as string);
    reorderFavorites(arrayMove(favoriteIds, oldIndex, newIndex));
  }

  if (!settled && tools.length === 0) return <WidgetSkeleton id="favorites" />;

  const cardProps = (tool: ToolManifest) => ({
    name: toolName(tool),
    description: toolDescription(tool),
    icon: tool.icon,
    credits: tool.creditsPerUse,
    status: tool.status,
    category: categoryLabel(tool.category),
    isFavorite: favoriteIds.includes(tool.id),
    onToggleFavorite: () => toggleFavorite(tool.id),
    onClick: () => router.push(`/tools/${tool.id}`),
  });

  return (
    <section>
      <WidgetHeader
        title={
          isDraggable
            ? t("dashboard.favoriteTools")
            : t("dashboard.quickAccess")
        }
      />
      {isDraggable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={favoriteIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shownTools.map((tool) => (
                <SortableToolCard
                  key={tool.id}
                  id={tool.id}
                  dragLabel={t("dashboard.dragToReorder", {
                    name: toolName(tool),
                  })}
                  {...cardProps(tool)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shownTools.map((tool) => (
            <ToolCard key={tool.id} {...cardProps(tool)} />
          ))}
          {shownTools.length === 0 && (
            <EmptyState
              icon="🛠️"
              title={t("dashboard.noToolsTitle")}
              description={t("dashboard.noToolsDescription")}
              className="col-span-full"
            />
          )}
        </div>
      )}
    </section>
  );
}

type SortableToolCardProps = ComponentProps<typeof ToolCard> & {
  id: string;
  dragLabel: string;
};

function SortableToolCard({ id, dragLabel, ...card }: SortableToolCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition:
          transition || "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
        zIndex: isDragging ? 50 : 0,
      }}
      className={cn(
        "relative min-w-0 transition-all duration-200",
        isDragging &&
          "rounded-xl shadow-2xl shadow-primary/20 ring-2 ring-primary/30 scale-[1.03] opacity-90",
      )}
    >
      <div
        {...listeners}
        {...attributes}
        // Holding this handle drags the card, never the whole widget.
        {...NO_WIDGET_DRAG}
        role="button"
        aria-label={dragLabel}
        tabIndex={0}
        className={cn(
          "absolute -top-2 -left-2 z-20",
          // Rearranging the dashboard: only the widget's own controls show.
          "group-data-[editing]/widget:hidden",
          // touch-none: lets dnd-kit's pointer sensor drag on touch screens.
          "flex h-8 w-8 pointer-coarse:h-10 pointer-coarse:w-10 touch-none items-center justify-center rounded-lg",
          "bg-surface border border-border-subtle shadow-sm",
          "cursor-grab active:cursor-grabbing",
          "text-text-dim hover:text-text-muted hover:bg-surface-elevated hover:border-border hover:shadow-md",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          "active:scale-90",
          isDragging &&
            "bg-primary/10 border-primary/30 text-primary shadow-lg",
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="9" cy="19" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <ToolCard {...card} />
    </div>
  );
}
