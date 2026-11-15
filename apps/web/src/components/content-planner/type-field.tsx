"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ActionConfirmDialog, Button, Input, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import {
  CONTENT_EVENT_TYPES,
  CUSTOM_TYPE_NAME_MAX,
  type ContentEventType,
} from "@/lib/content-planner/types";
import type { PaletteColor, PaletteIcon } from "@/lib/content-planner/palette";
import { useContentPlannerStore } from "@/store/content-planner.store";
import { AppearancePicker } from "./appearance-picker";
import { IconButton } from "./icon-button";
import { SelectField } from "./select-field";

const CUSTOM_PREFIX = "custom:";

/** Select value of a custom type; built-in types use their enum value. */
export function customTypeValue(id: string): string {
  return `${CUSTOM_PREFIX}${id}`;
}

/** Turns the select value into what the API expects. */
export function parseTypeValue(value: string): {
  type: ContentEventType;
  customTypeId: string | null;
} {
  if (value.startsWith(CUSTOM_PREFIX)) {
    return { type: "OTHER", customTypeId: value.slice(CUSTOM_PREFIX.length) };
  }
  const type = (CONTENT_EVENT_TYPES as readonly string[]).includes(value)
    ? (value as ContentEventType)
    : "OTHER";
  return { type, customTypeId: null };
}

interface TypeFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Session type picker: built-in types, the user's custom types, a "+" button
 * to create a new custom type inline, and a delete button while one is
 * selected.
 */
export function TypeField({ value, onChange }: TypeFieldProps) {
  const { t } = useI18n();
  const panelId = useId();
  const customTypes = useContentPlannerStore((s) => s.customTypes);
  const createCustomType = useContentPlannerStore((s) => s.createCustomType);
  const deleteCustomType = useContentPlannerStore((s) => s.deleteCustomType);

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<PaletteColor>("teal");
  const [icon, setIcon] = useState<PaletteIcon>("tag");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { customTypeId } = parseTypeValue(value);
  const selectedCustom = customTypes.find((ct) => ct.id === customTypeId);

  const closePanel = () => {
    setIsCreating(false);
    setName("");
    setError(null);
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("contentPlanner.customTypes.errors.nameRequired"));
      return;
    }
    // Same rule as the API, checked early for instant feedback.
    if (
      customTypes.some((ct) => ct.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setError(t("contentPlanner.customTypes.errors.duplicate"));
      return;
    }
    setIsSaving(true);
    try {
      const created = await createCustomType(trimmed, color, icon);
      onChange(customTypeValue(created.id));
      toast.success(
        t("contentPlanner.customTypes.created", { name: created.name }),
      );
      closePanel();
    } catch (err) {
      setError(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.customTypes.createFailed",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCustom) return;
    setIsDeleting(true);
    try {
      await deleteCustomType(selectedCustom.id);
      onChange("OTHER");
      toast.success(t("contentPlanner.customTypes.deleted"));
      setConfirmDelete(false);
    } catch (err) {
      toast.error(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.customTypes.deleteFailed",
        ),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5">
        <div className="min-w-0 flex-1">
          <SelectField
            label={t("contentPlanner.event.type")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={CONTENT_EVENT_TYPES.map((type) => ({
              value: type,
              label: t(`contentPlanner.types.${type}`),
            }))}
            groups={[
              {
                label: t("contentPlanner.customTypes.groupLabel"),
                options: customTypes.map((ct) => ({
                  value: customTypeValue(ct.id),
                  label: ct.name,
                })),
              },
            ]}
          />
        </div>
        {selectedCustom && (
          <IconButton
            label={t("contentPlanner.customTypes.delete")}
            onClick={() => setConfirmDelete(true)}
            className="hover:text-error"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton
          label={t("contentPlanner.customTypes.add")}
          onClick={() => (isCreating ? closePanel() : setIsCreating(true))}
          aria-expanded={isCreating}
          aria-controls={panelId}
          className={cn(isCreating && "border-primary text-primary")}
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>

      {isCreating && (
        <div
          id={panelId}
          className="space-y-3 rounded-lg border border-border bg-surface-elevated/50 p-3"
        >
          <Input
            label={t("contentPlanner.customTypes.name")}
            placeholder={t("contentPlanner.customTypes.namePlaceholder")}
            value={name}
            maxLength={CUSTOM_TYPE_NAME_MAX}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              // This panel lives inside the session form: Enter creates the
              // type instead of submitting the whole session.
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
          <AppearancePicker
            color={color}
            icon={icon}
            onColorChange={setColor}
            onIconChange={setIcon}
          />
          {error && (
            <p role="alert" className="text-xs text-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closePanel}
            >
              {t("contentPlanner.customTypes.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={isSaving}
              onClick={() => void handleCreate()}
            >
              {t("contentPlanner.customTypes.create")}
            </Button>
          </div>
        </div>
      )}

      <ActionConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title={t("contentPlanner.customTypes.confirmDelete", {
          name: selectedCustom?.name ?? "",
        })}
        description={t("contentPlanner.customTypes.confirmDeleteDescription")}
        confirmLabel={t("contentPlanner.event.delete")}
        cancelLabel={t("contentPlanner.event.cancel")}
      />
    </div>
  );
}
