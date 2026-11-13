"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";

const agents = [
  {
    id: "x-post-tweet",
    nameKey: "agents.items.xPost.name" as TranslationKey,
    descriptionKey: "agents.items.xPost.description" as TranslationKey,
    icon: "💬",
    color: "bg-blue-500/10",
    hoverColor: "hover:border-blue-500/30 hover:shadow-blue-500/5",
    badge: "primary" as const,
    badgeKey: "agents.badges.social" as TranslationKey,
    toolId: "x-post-tweet",
  },
  {
    id: "x-search-trends",
    nameKey: "agents.items.xResearch.name" as TranslationKey,
    descriptionKey: "agents.items.xResearch.description" as TranslationKey,
    icon: "📡",
    color: "bg-cyan-500/10",
    hoverColor: "hover:border-cyan-500/30 hover:shadow-cyan-500/5",
    badge: "accent" as const,
    badgeKey: "agents.badges.research" as TranslationKey,
    toolId: "x-search-trends",
  },
];

const upcomingAgents: {
  icon: string;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
}[] = [
  {
    icon: "🎬",
    nameKey: "agents.items.youtube.name",
    descriptionKey: "agents.items.youtube.description",
  },
  {
    icon: "📸",
    nameKey: "agents.items.instagram.name",
    descriptionKey: "agents.items.instagram.description",
  },
  {
    icon: "🎮",
    nameKey: "agents.items.twitch.name",
    descriptionKey: "agents.items.twitch.description",
  },
];

export default function AgentsPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.agents") },
        ]}
      />
      <div className="p-6 space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-text">{t("agents.title")}</h1>
          <p className="mt-1 text-text-muted">{t("agents.subtitle")}</p>
        </div>

        {/* Active Agents */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">
            {t("agents.yourAgents")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`group cursor-pointer rounded-xl border border-border bg-surface p-6 transition-all duration-200 ${agent.hoverColor} hover:shadow-lg`}
                onClick={() => router.push(`/tools/${agent.toolId}`)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-xl ${agent.color} text-3xl transition-colors`}
                  >
                    {agent.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-text">
                      {t(agent.nameKey)}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted line-clamp-2">
                      {t(agent.descriptionKey)}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant={agent.badge} size="sm">
                        {t(agent.badgeKey)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coming Soon */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">
            {t("agents.comingSoon")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingAgents.map((agent) => (
              <div
                key={agent.nameKey}
                className="rounded-xl border border-border bg-surface p-6 opacity-60"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-elevated text-3xl">
                    {agent.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">
                      {t(agent.nameKey)}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {t(agent.descriptionKey)}
                    </p>
                    <Badge variant="outline" size="sm" className="mt-3">
                      {t("agents.comingSoon")}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
