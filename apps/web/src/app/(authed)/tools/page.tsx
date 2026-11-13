"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToolsStore } from "@/store/tools.store";
import { useFavoritesStore } from "@/store/favorites.store";
import { ToolCard, EmptyState, Badge } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { useI18n } from "@/i18n/i18n-provider";
import { useToolText } from "@/i18n/use-tool-text";
import type { TranslationKey } from "@/i18n/translate";

const categories: {
  id: string;
  labelKey: TranslationKey;
  toolCategories?: string[];
}[] = [
  { id: "all", labelKey: "tools.filters.all" },
  {
    id: "ai-image",
    labelKey: "tools.filters.aiImage",
    toolCategories: ["thumbnail", "design"],
  },
  {
    id: "ai-text",
    labelKey: "tools.filters.aiText",
    toolCategories: ["title", "writing", "translator"],
  },
  {
    id: "ai-video",
    labelKey: "tools.filters.aiVideo",
    toolCategories: ["video"],
  },
  {
    id: "social",
    labelKey: "tools.filters.social",
    toolCategories: ["social"],
  },
  {
    id: "analytics",
    labelKey: "tools.filters.analytics",
    toolCategories: ["analytics"],
  },
];

const upcomingTools: {
  icon: string;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
}[] = [
  {
    icon: "🧠",
    nameKey: "tools.upcoming.repurposer.name",
    descriptionKey: "tools.upcoming.repurposer.description",
  },
  {
    icon: "📈",
    nameKey: "tools.upcoming.seo.name",
    descriptionKey: "tools.upcoming.seo.description",
  },
  {
    icon: "🎵",
    nameKey: "tools.upcoming.audio.name",
    descriptionKey: "tools.upcoming.audio.description",
  },
];

export default function ToolsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { toolName, toolDescription, categoryLabel } = useToolText();
  const { tools, fetchTools } = useToolsStore();
  const { favoriteIds, fetchFavorites, toggleFavorite } = useFavoritesStore();
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    fetchTools();
    fetchFavorites();
  }, [fetchTools, fetchFavorites]);

  const filtered =
    activeCategory === "all"
      ? tools
      : tools.filter((t) => {
          const cat = categories.find((c) => c.id === activeCategory);
          return cat?.toolCategories?.includes(t.category);
        });

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("nav.tools") },
        ]}
      />
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-text">{t("tools.title")}</h1>
          <p className="mt-1 text-text-muted">{t("tools.subtitle")}</p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
                activeCategory === cat.id
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "bg-surface-elevated text-text-muted hover:text-text border border-border hover:border-border/80"
              }`}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => (
            <ToolCard
              key={tool.id}
              name={toolName(tool)}
              description={toolDescription(tool)}
              icon={tool.icon}
              credits={tool.creditsPerUse}
              status={tool.status}
              category={categoryLabel(tool.category)}
              isFavorite={favoriteIds?.includes(tool.id) ?? false}
              onToggleFavorite={() => toggleFavorite(tool.id)}
              onClick={() => router.push(`/tools/${tool.id}`)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon="🛠️"
            title={t("tools.emptyTitle")}
            description={t("tools.emptyDescription")}
          />
        )}

        {/* Coming Soon */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">
            {t("tools.comingSoon")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingTools.map((item) => (
              <div
                key={item.nameKey}
                className="rounded-xl border border-border bg-surface p-5 opacity-60 cursor-not-allowed"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated text-lg">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text">
                        {t(item.nameKey)}
                      </h3>
                      <p className="text-sm text-text-muted">
                        {t(item.descriptionKey)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Badge variant="outline" size="sm">
                    {t("tools.comingSoon")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
