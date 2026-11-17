"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@creator-hub/ui";
import type { CreditState } from "@creator-hub/shared-types";
import api from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";
import { EmailPreview } from "./email-preview";
import {
  apiErrorMessage,
  useCreditStateLabel,
  type CreditEmailInput,
  type CreditEmailTrigger,
} from "./types";

const VARIABLES: { key: string; descriptionKey: TranslationKey }[] = [
  { key: "name", descriptionKey: "creditEmails.editor.variables.name" },
  { key: "credits", descriptionKey: "creditEmails.editor.variables.credits" },
  {
    key: "threshold",
    descriptionKey: "creditEmails.editor.variables.threshold",
  },
  {
    key: "purchaseUrl",
    descriptionKey: "creditEmails.editor.variables.purchaseUrl",
  },
];

const inputClass =
  "w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/50";

/** Suggested content when creating an email for a state. */
function defaultContent(state: CreditState): CreditEmailInput {
  if (state === "CREDIT_DEPLETED") {
    return {
      subject: "You're out of credits",
      heading: "You've used all your credits",
      body: "Hi {{name}},\n\nYou don't have enough credits left to keep using your tools. Purchase credits to continue creating.",
      ctaLabel: "Purchase credits",
      ctaUrl: "{{purchaseUrl}}",
      isActive: true,
    };
  }
  return {
    subject: "You have {{credits}} credits left",
    heading: "You're running low on credits",
    body: "Hi {{name}},\n\nYour Creator Hub balance just dropped to {{credits}} credits. Top up now so your next creation isn't interrupted.",
    ctaLabel: "Buy credits",
    ctaUrl: "{{purchaseUrl}}",
    isActive: true,
  };
}

type TextField = "subject" | "heading" | "body";

export function CreditEmailEditor({
  state,
  trigger,
  onSave,
  onCancel,
  isSaving,
}: {
  state: CreditState;
  trigger: CreditEmailTrigger | null;
  onSave: (data: CreditEmailInput) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { t } = useI18n();
  const stateLabel = useCreditStateLabel();
  const [form, setForm] = useState<CreditEmailInput>(() =>
    trigger
      ? {
          subject: trigger.subject,
          heading: trigger.heading,
          body: trigger.body,
          ctaLabel: trigger.ctaLabel ?? "",
          ctaUrl: trigger.ctaUrl ?? "",
          isActive: trigger.isActive,
        }
      : defaultContent(state),
  );
  const [focused, setFocused] = useState<TextField>("body");
  const refs = {
    subject: useRef<HTMLInputElement>(null),
    heading: useRef<HTMLInputElement>(null),
    body: useRef<HTMLTextAreaElement>(null),
  };

  const set =
    (key: keyof CreditEmailInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  /** Inserts {{variable}} at the cursor of the last focused text field. */
  const insertVariable = (key: string) => {
    const el = refs[focused].current;
    const token = `{{${key}}}`;
    const value = form[focused];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setForm((f) => ({
      ...f,
      [focused]: value.slice(0, start) + token + value.slice(end),
    }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  // Live preview rendered by the API with the real email template.
  const debounced = useDebounce(form, 400);
  const canPreview = Boolean(
    debounced.subject.trim() &&
    debounced.heading.trim() &&
    debounced.body.trim(),
  );
  const preview = useQuery({
    queryKey: ["credit-email-preview", state, debounced],
    enabled: canPreview,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const res = await api.post<{ subject: string; html: string }>(
        "/admin/credit-email-triggers/preview",
        {
          state,
          subject: debounced.subject,
          heading: debounced.heading,
          body: debounced.body,
          ctaLabel: debounced.ctaLabel || null,
          ctaUrl: debounced.ctaUrl || null,
        },
      );
      return res.data;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      subject: form.subject.trim(),
      heading: form.heading.trim(),
      body: form.body.trim(),
      ctaLabel: form.ctaLabel.trim(),
      ctaUrl: form.ctaUrl.trim(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          {t("creditEmails.editor.sentOnce", { state: stateLabel(state) })}
        </p>

        <div>
          <label
            htmlFor="subject"
            className="mb-1 block text-sm font-medium text-text"
          >
            {t("creditEmails.editor.subject")}
          </label>
          <input
            id="subject"
            ref={refs.subject}
            value={form.subject}
            onChange={set("subject")}
            onFocus={() => setFocused("subject")}
            maxLength={200}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="heading"
            className="mb-1 block text-sm font-medium text-text"
          >
            {t("creditEmails.editor.heading")}
          </label>
          <input
            id="heading"
            ref={refs.heading}
            value={form.heading}
            onChange={set("heading")}
            onFocus={() => setFocused("heading")}
            maxLength={200}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="body"
            className="mb-1 block text-sm font-medium text-text"
          >
            {t("creditEmails.editor.message")}
          </label>
          <textarea
            id="body"
            ref={refs.body}
            value={form.body}
            onChange={set("body")}
            onFocus={() => setFocused("body")}
            rows={7}
            maxLength={5000}
            required
            className={`${inputClass} resize-y`}
          />
          <p className="mt-1 text-xs text-text-dim">
            {t("creditEmails.editor.variablesHint")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                title={t(v.descriptionKey)}
                onClick={() => insertVariable(v.key)}
                className="rounded border border-dashed border-primary/40 bg-primary/10 px-1.5 py-0.5 pointer-coarse:px-2.5 pointer-coarse:py-1.5 font-mono text-xs text-primary hover:bg-primary/20"
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="ctaLabel"
              className="mb-1 block text-sm font-medium text-text"
            >
              {t("creditEmails.editor.buttonText")}
            </label>
            <input
              id="ctaLabel"
              value={form.ctaLabel}
              onChange={set("ctaLabel")}
              placeholder={t("creditEmails.editor.buttonTextPlaceholder")}
              maxLength={60}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="ctaUrl"
              className="mb-1 block text-sm font-medium text-text"
            >
              {t("creditEmails.editor.buttonLink")}
            </label>
            <input
              id="ctaUrl"
              value={form.ctaUrl}
              onChange={set("ctaUrl")}
              placeholder="{{purchaseUrl}}"
              maxLength={500}
              className={inputClass}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-text-dim">
          {t("creditEmails.editor.buttonHint")}
        </p>

        <div className="flex items-center gap-3">
          <Switch
            checked={form.isActive}
            onCheckedChange={(checked: boolean) =>
              setForm((f) => ({ ...f, isActive: checked }))
            }
          />
          <span className="text-sm text-text-muted">
            {t("creditEmails.editor.active")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 sm:flex sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated disabled:opacity-50 sm:min-h-0"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:min-h-0"
          >
            {isSaving
              ? t("common.saving")
              : trigger
                ? t("common.saveChanges")
                : t("creditEmails.editor.create")}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text">
          {t("creditEmails.editor.preview")}
        </p>
        {canPreview ? (
          <EmailPreview
            subject={preview.data?.subject}
            html={preview.data?.html}
            isLoading={preview.isLoading}
            isRefreshing={preview.isFetching && !preview.isLoading}
            error={
              preview.error
                ? apiErrorMessage(
                    preview.error,
                    t("creditEmails.editor.previewUnavailable"),
                  )
                : null
            }
          />
        ) : (
          <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-dim">
            {t("creditEmails.editor.previewPlaceholder")}
          </div>
        )}
        <p className="mt-2 text-xs text-text-dim">
          {t("creditEmails.editor.previewSample")}
        </p>
      </div>
    </form>
  );
}
