"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { LOCALES, LOCALE_META, type Locale } from "@/i18n/config";
import { translate } from "@/i18n/translate";

/**
 * Applies a new interface language and confirms it with a toast written in
 * the *new* language, so the user immediately sees the change took effect.
 */
function useChangeLanguage() {
  const { setLocale } = useI18n();
  return (next: Locale) => {
    const changed = setLocale(next);
    if (changed) {
      toast.success(
        translate(next, "language.changed", {
          language: LOCALE_META[next].nativeName,
        }),
        // Top-center: clearly visible, and unlike the default top-right
        // position it never covers the language selector itself.
        { id: "language-changed", position: "top-center" },
      );
    }
  };
}

interface LanguageSelectorProps {
  /** `compact` shows only the flag + code (e.g. in tight headers). */
  compact?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
}

/** Dropdown language switcher for headers and the sign-in screens. */
export function LanguageSelector({
  compact = false,
  align = "end",
  className,
}: LanguageSelectorProps) {
  const { locale, t } = useI18n();
  const changeLanguage = useChangeLanguage();
  const current = LOCALE_META[locale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("language.selectorAriaLabel", {
            language: current.nativeName,
          })}
          title={t("language.label")}
          data-testid="language-selector"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-primary/40 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            className,
          )}
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-hidden="true">{current.flag}</span>
          <span>{compact ? locale.toUpperCase() : current.nativeName}</span>
          <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>{t("language.menuTitle")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((code) => {
          const meta = LOCALE_META[code];
          const selected = code === locale;
          return (
            <DropdownMenuItem
              key={code}
              lang={code}
              aria-current={selected ? "true" : undefined}
              data-testid={`language-option-${code}`}
              onSelect={() => changeLanguage(code)}
              className={cn(selected && "bg-primary/10 text-primary")}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {meta.flag}
              </span>
              <span className="flex-1">
                <span className="block font-medium">{meta.nativeName}</span>
                {code !== "en" && (
                  <span className="block text-[11px] text-text-dim">
                    {meta.englishName}
                  </span>
                )}
              </span>
              {selected && <Check className="h-4 w-4" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Full-width option list used on the Settings page. */
export function LanguageOptions({
  savedToAccount,
}: {
  savedToAccount: boolean;
}) {
  const { locale, t } = useI18n();
  const changeLanguage = useChangeLanguage();

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label={t("language.label")}
        className="grid gap-3 sm:grid-cols-3"
      >
        {LOCALES.map((code) => {
          const meta = LOCALE_META[code];
          const selected = code === locale;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={code}
              data-testid={`language-card-${code}`}
              onClick={() => changeLanguage(code)}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                selected
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border bg-surface-elevated hover:border-primary/40",
              )}
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {meta.flag}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    selected ? "text-primary" : "text-text",
                  )}
                >
                  {meta.nativeName}
                </span>
                <span className="block text-xs text-text-dim">
                  {selected ? t("language.current") : meta.englishName}
                </span>
              </span>
              {selected && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-text-dim">
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        {savedToAccount
          ? t("language.savedToAccount")
          : t("language.savedOnDevice")}
      </p>
    </div>
  );
}
