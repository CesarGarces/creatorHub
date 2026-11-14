"use client";

import { toast } from "sonner";
import {
  LanguageSelector,
  type LanguageSelectorProps,
} from "@creator-hub/i18n";

/**
 * The same language dropdown as the web app and landing page. The toast is
 * written in the newly selected language and shown top-center so it never
 * covers the selector.
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
          position: "top-center",
        })
      }
    />
  );
}
