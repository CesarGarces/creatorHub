"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button, Input, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { BUILTIN_LOOKS } from "@/lib/content-planner/palette";
import {
  MAX_STEPS,
  MAX_STEP_MINUTES,
  STEP_NAME_MAX,
  createStep,
  insertStep,
  moveStep,
  stepLook,
  stepName,
  type ProductionStep,
} from "@/lib/content-planner/steps";
import type { ContentEventType } from "@/lib/content-planner/types";
import { AppearancePicker } from "./appearance-picker";
import { lookStyle } from "./event-type-meta";

interface StepsEditorProps {
  steps: ProductionStep[];
  onChange: (steps: ProductionStep[]) => void;
  onReset: () => void;
}

/**
 * Editable list of production steps: reorder by dragging (or with the
 * keyboard on the grip), enable/disable, set durations, rename, recolor,
 * change the icon, delete and add steps. The publishing step stays last.
 */
export function StepsEditor({ steps, onChange, onReset }: StepsEditorProps) {
  const { t } = useI18n();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const builtinName = (type: ContentEventType) =>
    t(`contentPlanner.types.${type}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const workSteps = steps.filter((s) => !s.isPublish);
  const publishSteps = steps.filter((s) => s.isPublish);

  const update = (key: string, patch: Partial<ProductionStep>) =>
    onChange(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const remove = (key: string) => {
    if (editingKey === key) setEditingKey(null);
    onChange(steps.filter((s) => s.key !== key));
  };

  const add = () => {
    const step = createStep(steps, t("contentPlanner.plan.steps.newStep"));
    onChange(insertStep(steps, step));
    setEditingKey(step.key);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) onChange(moveStep(steps, String(active.id), String(over.id)));
  };

  const rowProps = (step: ProductionStep) => ({
    step,
    name: stepName(step, builtinName),
    isEditing: editingKey === step.key,
    onToggleEdit: () =>
      setEditingKey((k) => (k === step.key ? null : step.key)),
    onUpdate: (patch: Partial<ProductionStep>) => update(step.key, patch),
    onRemove: () => remove(step.key),
    builtinName,
  });

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={workSteps.map((s) => s.key)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            className="space-y-2"
            aria-label={t("contentPlanner.plan.stages")}
          >
            {workSteps.map((step) => (
              <SortableStepRow key={step.key} {...rowProps(step)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {publishSteps.length > 0 && (
        <ul className="space-y-2">
          {publishSteps.map((step) => (
            <StepRow key={step.key} {...rowProps(step)} pinned />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={steps.length >= MAX_STEPS}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("contentPlanner.plan.steps.add")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          {t("contentPlanner.plan.steps.reset")}
        </Button>
      </div>
    </div>
  );
}

interface StepRowProps {
  step: ProductionStep;
  name: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (patch: Partial<ProductionStep>) => void;
  onRemove: () => void;
  builtinName: (type: ContentEventType) => string;
  pinned?: boolean;
  /** Drag handle props (sortable rows only). */
  handle?: React.HTMLAttributes<HTMLButtonElement>;
  rowRef?: (node: HTMLElement | null) => void;
  rowStyle?: React.CSSProperties;
  isDragging?: boolean;
}

function SortableStepRow(props: Omit<StepRowProps, "handle" | "rowRef">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.step.key });
  return (
    <StepRow
      {...props}
      rowRef={setNodeRef}
      rowStyle={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      handle={{ ...attributes, ...listeners }}
    />
  );
}

function StepRow({
  step,
  name,
  isEditing,
  onToggleEdit,
  onUpdate,
  onRemove,
  builtinName,
  pinned,
  handle,
  rowRef,
  rowStyle,
  isDragging,
}: StepRowProps) {
  const { t } = useI18n();
  const look = stepLook(step);
  const style = lookStyle(look);
  const Icon = style.icon;
  const [nameError, setNameError] = useState<string | null>(null);
  const checkboxId = `step-${step.key}`;

  // Built-in steps: choosing the built-in value again keeps them untouched.
  const base = step.baseType ? BUILTIN_LOOKS[step.baseType] : null;
  const builtinLabel = step.baseType ? builtinName(step.baseType) : null;

  const finishEditing = () => {
    const trimmed = (step.name ?? "").trim().replace(/\s+/g, " ");
    if (!trimmed || trimmed === builtinLabel) {
      if (!step.baseType) {
        setNameError(t("contentPlanner.plan.steps.errors.nameRequired"));
        return;
      }
      onUpdate({ name: null });
    } else if (trimmed !== step.name) {
      onUpdate({ name: trimmed });
    }
    setNameError(null);
    onToggleEdit();
  };

  return (
    <li
      ref={rowRef}
      style={rowStyle}
      data-testid={`step-row-${step.key}`}
      className={cn(
        "rounded-lg border border-border bg-surface transition-shadow",
        !step.enabled && "opacity-60",
        isDragging && "relative z-10 shadow-xl ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        {pinned ? (
          <span
            className="flex h-6 w-5 items-center justify-center text-text-dim"
            title={t("contentPlanner.plan.steps.pinned")}
          >
            <Pin className="h-3.5 w-3.5" />
          </span>
        ) : (
          <button
            type="button"
            {...handle}
            aria-label={t("contentPlanner.plan.steps.dragHandle", { name })}
            className="flex h-6 w-5 cursor-grab touch-none items-center justify-center rounded text-text-dim hover:text-text active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <input
          type="checkbox"
          id={checkboxId}
          checked={step.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
          className="h-4 w-4 accent-primary"
        />
        <label
          htmlFor={checkboxId}
          className="flex min-w-0 flex-1 items-center gap-2 text-sm text-text"
        >
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-l-[3px]",
              style.block,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className={cn(pinned ? "shrink-0" : "truncate")}>{name}</span>
          {pinned && (
            <span className="min-w-0 truncate rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] text-text-dim">
              {t("contentPlanner.plan.steps.atPublishTime")}
            </span>
          )}
        </label>
        <input
          type="number"
          min={15}
          max={MAX_STEP_MINUTES}
          step={15}
          value={step.durationMinutes}
          disabled={!step.enabled}
          aria-label={t("contentPlanner.plan.durationLabel", { stage: name })}
          onChange={(e) =>
            onUpdate({
              durationMinutes: Math.min(
                MAX_STEP_MINUTES,
                Math.max(0, Math.round(Number(e.target.value)) || 0),
              ),
            })
          }
          className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-text focus:border-primary focus:outline-none"
        />
        <span className="w-6 text-xs text-text-dim">
          {t("contentPlanner.plan.minutes")}
        </span>
        <button
          type="button"
          onClick={() => (isEditing ? finishEditing() : onToggleEdit())}
          aria-label={t("contentPlanner.plan.steps.edit", { name })}
          aria-expanded={isEditing}
          title={t("contentPlanner.plan.steps.edit", { name })}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-surface-elevated hover:text-text",
            isEditing && "bg-primary/15 text-primary",
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("contentPlanner.plan.steps.delete", { name })}
          title={t("contentPlanner.plan.steps.delete", { name })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-error/10 hover:text-error"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {isEditing && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <Input
            label={t("contentPlanner.plan.steps.name")}
            value={step.name ?? builtinLabel ?? ""}
            maxLength={STEP_NAME_MAX}
            autoFocus
            onChange={(e) => {
              setNameError(null);
              onUpdate({ name: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                finishEditing();
              }
            }}
          />
          <AppearancePicker
            color={look.color}
            icon={look.icon}
            onColorChange={(color) =>
              onUpdate({ color: base && color === base.color ? null : color })
            }
            onIconChange={(icon) =>
              onUpdate({ icon: base && icon === base.icon ? null : icon })
            }
          />
          {nameError && (
            <p role="alert" className="text-xs text-error">
              {nameError}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={finishEditing}>
              {t("contentPlanner.plan.steps.done")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
