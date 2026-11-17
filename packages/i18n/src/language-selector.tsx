"use client";

import type { ReactNode, SVGProps } from "react";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@creator-hub/ui";
import { LOCALES, LOCALE_META, type Locale } from "./config";
import { interpolate } from "./core";
import { languageChangedMessage, PACKAGE_MESSAGES } from "./package-messages";
import { useLocaleContext } from "./react";

// Inline icons (same paths as lucide's) keep this package dependency-free.
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}
const Globe = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </Icon>
);
const ChevronDown = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
const Check = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

/**
 * Called after a successful switch. `message` is a confirmation written in
 * the *new* language ("Idioma cambiado a Español"), ready for a toast, so
 * the user immediately sees the change took effect.
 */
export type LanguageChangedHandler = (locale: Locale, message: string) => void;

function useChangeLanguage(onChanged?: LanguageChangedHandler) {
  const { setLocale } = useLocaleContext();
  return (next: Locale) => {
    if (!setLocale(next)) return;
    onChanged?.(next, languageChangedMessage(next));
  };
}

export interface LanguageSelectorProps {
  /** `compact` shows flag + code ("ES") instead of the full name. */
  compact?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  onChanged?: LanguageChangedHandler;
}

/** Dropdown language switcher for headers and navigation bars. */
export function LanguageSelector({
  compact = false,
  align = "end",
  className,
  onChanged,
}: LanguageSelectorProps) {
  const { locale } = useLocaleContext();
  const changeLanguage = useChangeLanguage(onChanged);
  const current = LOCALE_META[locale];
  const strings = PACKAGE_MESSAGES[locale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={interpolate(locale, strings.selectorAriaLabel, {
            language: current.nativeName,
          })}
          title={strings.label}
          data-testid="language-selector"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-primary/40 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            className,
          )}
        >
          <Globe className="h-3.5 w-3.5" />
          <span aria-hidden="true">{current.flag}</span>
          <span>{compact ? locale.toUpperCase() : current.nativeName}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>{strings.menuTitle}</DropdownMenuLabel>
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
              {selected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface LanguageOptionsProps {
  onChanged?: LanguageChangedHandler;
  /** Extra line under the options (e.g. where the choice is saved). */
  footer?: ReactNode;
}

/** Full-width option cards, e.g. for a settings page. */
export function LanguageOptions({ onChanged, footer }: LanguageOptionsProps) {
  const { locale } = useLocaleContext();
  const changeLanguage = useChangeLanguage(onChanged);
  const strings = PACKAGE_MESSAGES[locale];

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label={strings.label}
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
                  {selected ? strings.current : meta.englishName}
                </span>
              </span>
              {selected && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
