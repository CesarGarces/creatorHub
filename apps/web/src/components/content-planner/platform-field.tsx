"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ActionConfirmDialog, Button, Input, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import {
  CONTENT_PLATFORMS,
  CUSTOM_PLATFORM_NAME_MAX,
  type ContentPlatform,
} from "@/lib/content-planner/types";
import { useContentPlannerStore } from "@/store/content-planner.store";
import { IconButton } from "./icon-button";
import { SelectField } from "./select-field";

const CUSTOM_PREFIX = "custom:";

export const customPlatformValue = (id: string) => `${CUSTOM_PREFIX}${id}`;

/** Select value → what the API expects for a project. */
export function parsePlatformValue(value: string): {
  platform?: ContentPlatform;
  customPlatformId?: string;
} {
  if (value.startsWith(CUSTOM_PREFIX)) {
    return { customPlatformId: value.slice(CUSTOM_PREFIX.length) };
  }
  return (CONTENT_PLATFORMS as readonly string[]).includes(value)
    ? { platform: value as ContentPlatform }
    : {};
}

interface PlatformFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Platform picker for "Plan a video": built-in platforms, the user's custom
 * platforms, "+" to add one inline and a delete button while one is chosen.
 */
export function PlatformField({ value, onChange }: PlatformFieldProps) {
  const { t } = useI18n();
  const panelId = useId();
  const platforms = useContentPlannerStore((s) => s.customPlatforms);
  const createCustomPlatform = useContentPlannerStore(
    (s) => s.createCustomPlatform,
  );
  const deleteCustomPlatform = useContentPlannerStore(
    (s) => s.deleteCustomPlatform,
  );

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { customPlatformId } = parsePlatformValue(value);
  const selected = platforms.find((p) => p.id === customPlatformId);

  const closePanel = () => {
    setIsCreating(false);
    setName("");
    setError(null);
  };

  const handleCreate = async () => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setError(t("contentPlanner.customPlatforms.errors.nameRequired"));
      return;
    }
    const taken =
      platforms.some((p) => p.name.toLowerCase() === trimmed.toLowerCase()) ||
      CONTENT_PLATFORMS.some(
        (p) =>
          t(`contentPlanner.platforms.${p}`).toLowerCase() ===
          trimmed.toLowerCase(),
      );
    if (taken) {
      setError(t("contentPlanner.customPlatforms.errors.duplicate"));
      return;
    }
    setIsSaving(true);
    try {
      const created = await createCustomPlatform(trimmed);
      onChange(customPlatformValue(created.id));
      toast.success(
        t("contentPlanner.customPlatforms.created", { name: created.name }),
      );
      closePanel();
    } catch (err) {
      setError(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.customPlatforms.createFailed",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      await deleteCustomPlatform(selected.id);
      onChange("youtube-long");
      toast.success(t("contentPlanner.customPlatforms.deleted"));
      setConfirmDelete(false);
    } catch (err) {
      toast.error(
        localizeError(
          err instanceof Error ? err.message : undefined,
          "contentPlanner.customPlatforms.deleteFailed",
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
            label={t("contentPlanner.plan.platform")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={CONTENT_PLATFORMS.map((p) => ({
              value: p,
              label: t(`contentPlanner.platforms.${p}`),
            }))}
            groups={[
              {
                label: t("contentPlanner.customPlatforms.groupLabel"),
                options: platforms.map((p) => ({
                  value: customPlatformValue(p.id),
                  label: p.name,
                })),
              },
            ]}
          />
        </div>
        {selected && (
          <IconButton
            label={t("contentPlanner.customPlatforms.delete")}
            onClick={() => setConfirmDelete(true)}
            className="hover:text-error"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton
          label={t("contentPlanner.customPlatforms.add")}
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
            label={t("contentPlanner.customPlatforms.name")}
            placeholder={t("contentPlanner.customPlatforms.namePlaceholder")}
            value={name}
            maxLength={CUSTOM_PLATFORM_NAME_MAX}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              // Inside the plan form: Enter adds the platform, not the plan.
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
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
              {t("contentPlanner.customPlatforms.create")}
            </Button>
          </div>
        </div>
      )}

      <ActionConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title={t("contentPlanner.customPlatforms.confirmDelete", {
          name: selected?.name ?? "",
        })}
        description={t(
          "contentPlanner.customPlatforms.confirmDeleteDescription",
        )}
        confirmLabel={t("contentPlanner.event.delete")}
        cancelLabel={t("contentPlanner.event.cancel")}
      />
    </div>
  );
}
