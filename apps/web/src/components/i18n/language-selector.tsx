"use client";

import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  LanguageOptions as SharedLanguageOptions,
  LanguageSelector as SharedLanguageSelector,
  type LanguageChangedHandler,
  type LanguageSelectorProps,
} from "@creator-hub/i18n";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Confirms the switch with a toast written in the new language. Shown
 * top-center: clearly visible, and unlike the default top-right position it
 * never covers the language selector itself.
 */
const announceChange: LanguageChangedHandler = (_locale, message) => {
  toast.success(message, { id: "language-changed", position: "top-center" });
};

/** Dropdown language switcher (top bar, sign-in screens, share page). */
export function LanguageSelector(
  props: Omit<LanguageSelectorProps, "onChanged">,
) {
  return <SharedLanguageSelector {...props} onChanged={announceChange} />;
}

/** Full-width option list used on the Settings page. */
export function LanguageOptions({
  savedToAccount,
}: {
  savedToAccount: boolean;
}) {
  const { t } = useI18n();
  return (
    <SharedLanguageOptions
      onChanged={announceChange}
      footer={
        <p className="flex items-center gap-1.5 text-xs text-text-dim">
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          {savedToAccount
            ? t("language.savedToAccount")
            : t("language.savedOnDevice")}
        </p>
      }
    />
  );
}
