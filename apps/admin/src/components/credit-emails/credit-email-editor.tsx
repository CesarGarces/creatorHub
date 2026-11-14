"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@creator-hub/ui";
import type { CreditState } from "@creator-hub/shared-types";
import api from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { EmailPreview } from "./email-preview";
import {
  apiErrorMessage,
  creditStateLabel,
  type CreditEmailInput,
  type CreditEmailTrigger,
} from "./types";

const VARIABLES = [
  { key: "name", description: "User's name (or email)" },
  { key: "credits", description: "Credits remaining" },
  { key: "threshold", description: "Credit level of this email" },
  { key: "purchaseUrl", description: "Credits purchase page" },
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
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Sent once when a user&apos;s balance drops to{" "}
          <span className="font-medium text-text">
            {creditStateLabel(state)}
          </span>
          .
        </p>

        <div>
          <label
            htmlFor="subject"
            className="mb-1 block text-sm font-medium text-text"
          >
            Subject
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
            Heading
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
            Message
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
            Leave an empty line between paragraphs. Insert into the {focused}:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.description}
                onClick={() => insertVariable(v.key)}
                className="rounded border border-dashed border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary/20"
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="ctaLabel"
              className="mb-1 block text-sm font-medium text-text"
            >
              Button text
            </label>
            <input
              id="ctaLabel"
              value={form.ctaLabel}
              onChange={set("ctaLabel")}
              placeholder="Purchase credits"
              maxLength={60}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="ctaUrl"
              className="mb-1 block text-sm font-medium text-text"
            >
              Button link
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
          Leave the link empty to use the credits purchase page. Clear the
          button text to hide the button.
        </p>

        <div className="flex items-center gap-3">
          <Switch
            checked={form.isActive}
            onCheckedChange={(checked: boolean) =>
              setForm((f) => ({ ...f, isActive: checked }))
            }
          />
          <span className="text-sm text-text-muted">Active</span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : trigger ? "Save Changes" : "Create Email"}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text">Preview</p>
        {canPreview ? (
          <EmailPreview
            subject={preview.data?.subject}
            html={preview.data?.html}
            isLoading={preview.isLoading}
            isRefreshing={preview.isFetching && !preview.isLoading}
            error={
              preview.error
                ? apiErrorMessage(preview.error, "Preview unavailable")
                : null
            }
          />
        ) : (
          <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-dim">
            Fill in the subject, heading and message to see a preview
          </div>
        )}
        <p className="mt-2 text-xs text-text-dim">
          Sample user &quot;Jane Doe&quot;. Variables are filled with example
          values.
        </p>
      </div>
    </form>
  );
}
