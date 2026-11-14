"use client";

import { toast } from "sonner";
import {
  LanguageSelector,
  type LanguageSelectorProps,
} from "@creator-hub/i18n";

/**
 * The same language dropdown as the web app. The confirmation toast is
 * written in the newly selected language and shown bottom-center, clear of
 * the navigation bar and the selector itself.
 */
export function LanguageSwitcher(
  props: Omit<LanguageSelectorProps, "onChanged">,
) {
  return (
    <LanguageSelector
      {...props}
      onChanged={(_locale, message) =>
        toast.success(message, {
          id: "language-changed",
          position: "bottom-center",
        })
      }
    />
  );
}
