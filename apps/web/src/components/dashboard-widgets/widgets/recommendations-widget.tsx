"use client";

import Link from "next/link";
import { Badge, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";
import { WidgetHeader } from "../widget-header";

interface Recommendation {
  href: string;
  emoji: string;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
  badgeKey: TranslationKey;
  badge: "primary" | "accent";
  /** Hover accent of the card and its icon tile. */
  tone: string;
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    href: "/tools/x-post-tweet",
    emoji: "💬",
    nameKey: "agents.items.xPost.name",
    descriptionKey: "agents.items.xPost.shortDescription",
    badgeKey: "agents.badges.social",
    badge: "primary",
    tone: "hover:border-blue-500/30 hover:shadow-blue-500/5 [&_.tile]:bg-blue-500/10 [&:hover_.tile]:bg-blue-500/20",
  },
  {
    href: "/tools/x-search-trends",
    emoji: "📡",
    nameKey: "agents.items.xResearch.name",
    descriptionKey: "agents.items.xResearch.shortDescription",
    badgeKey: "agents.badges.research",
    badge: "accent",
    tone: "hover:border-cyan-500/30 hover:shadow-cyan-500/5 [&_.tile]:bg-cyan-500/10 [&:hover_.tile]:bg-cyan-500/20",
  },
];

/**
 * Recommended agents. Side by side when the widget is wide enough
 * (container query): full width on tablets, a half-width cell on desktop.
 */
export function RecommendationsWidget() {
  const { t } = useI18n();

  return (
    <section className="@container">
      <WidgetHeader title={t("dashboard.recommendedAgents")} />
      <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
        {RECOMMENDATIONS.map((item) => (
          <li key={item.href} className="min-w-0">
            <Link
              href={item.href}
              className={cn(
                "group flex h-full items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:shadow-lg",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                item.tone,
              )}
            >
              <span
                aria-hidden="true"
                className="tile flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl transition-colors"
              >
                {item.emoji}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-text">
                  {t(item.nameKey)}
                </span>
                <span className="mt-1 block text-sm text-text-muted">
                  {t(item.descriptionKey)}
                </span>
                <span className="mt-3 flex items-center gap-2">
                  <Badge variant={item.badge} size="sm">
                    {t(item.badgeKey)}
                  </Badge>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
