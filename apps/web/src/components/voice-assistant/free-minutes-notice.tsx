"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@creator-hub/ui";
import type { VoiceAllowance } from "@creator-hub/shared-types";
import { useI18n } from "@/i18n/i18n-provider";

export interface FreeMinutesNoticeProps {
  /** The user's Free plan minutes with Robotina (`GET /voice/allowance`). */
  allowance: VoiceAllowance | null;
  /** Smaller, for the dashboard widget. */
  compact?: boolean;
  className?: string;
}

/**
 * The Free plan's minutes with Robotina (Admin → Voice): a quiet "7 of 10
 * free minutes left" while there are some, and — once they are used up —
 * an invitation to upgrade for unlimited use (with the date they come
 * back, for a monthly limit). Renders nothing for paid plans or when no
 * limit is set.
 */
export function FreeMinutesNotice({
  allowance,
  compact = false,
  className,
}: FreeMinutesNoticeProps) {
  const { t, formatDate } = useI18n();
  if (!allowance?.limited) return null;
  const total =
    allowance.limitSeconds === null
      ? null
      : Math.round(allowance.limitSeconds / 60);
  const monthly = allowance.period === "monthly";

  if (!allowance.exhausted) {
    if (total === null) return null;
    const left = Math.ceil((allowance.remainingSeconds ?? 0) / 60);
    return (
      <p
        className={cn(
          "text-[11px] text-text-dim",
          compact && "text-center",
          className,
        )}
      >
        {t(
          monthly
            ? "voiceAssistant.freeTier.remainingMonthly"
            : "voiceAssistant.freeTier.remainingTotal",
          { count: left, total },
        )}
      </p>
    );
  }

  return (
    <div
      aria-live="polite"
      data-free-minutes-exhausted
      className={cn(
        "rounded-xl border border-amber-500/30 bg-amber-500/10 text-left",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400",
            compact ? "h-8 w-8" : "h-10 w-10",
          )}
        >
          <Sparkles size={compact ? 16 : 20} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold text-text",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {total === null
              ? t("voiceAssistant.freeTier.exhaustedTitleNoTotal")
              : t("voiceAssistant.freeTier.exhaustedTitle", { total })}
          </p>
          <p
            className={cn(
              "mt-1 text-text-muted",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            {monthly && allowance.resetsAt
              ? t("voiceAssistant.freeTier.exhaustedMonthly", {
                  date: formatDate(allowance.resetsAt, {
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  }),
                })
              : t("voiceAssistant.freeTier.exhaustedLifetime")}
          </p>
          <Link
            href="/credits"
            className={cn(
              "mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground transition-colors hover:bg-primary-hover sm:min-h-9",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {t("voiceAssistant.freeTier.upgrade")}
          </Link>
        </div>
      </div>
    </div>
  );
}
