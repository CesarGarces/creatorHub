"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToolsStore } from "@/store/tools.store";
import { ToolCard, Badge, EmptyState } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";

const categories = [
  { id: "all", label: "All" },
  { id: "ai-image", label: "AI Image" },
  { id: "ai-text", label: "AI Text" },
  { id: "ai-video", label: "AI Video" },
  { id: "streaming", label: "Streaming" },
  { id: "analytics", label: "Analytics" },
  { id: "growth", label: "Growth" },
];

export default function ToolsPage() {
  const router = useRouter();
  const { tools, fetchTools } = useToolsStore();
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const filtered = activeCategory === "all"
    ? tools
    : tools.filter((t) => t.category === activeCategory);

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tools" },
        ]}
      />
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-text">Tools</h1>
          <p className="mt-1 text-text-muted">AI-powered tools for content creators</p>
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
              {cat.label}
            </button>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => (
            <ToolCard
              key={tool.id}
              name={tool.name}
              description={tool.description}
              icon={tool.icon}
              credits={tool.creditsPerUse}
              status={tool.status}
              category={tool.category}
              onClick={() => router.push(`/tools/${tool.id}`)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon="🛠️"
            title="No tools in this category"
            description="Check back soon for new tools."
          />
        )}

        {/* Coming Soon */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">Coming Soon</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "🧠", name: "Content Repurposer", description: "Turn one piece of content into 10 formats" },
              { icon: "📈", name: "SEO Optimizer", description: "Optimize your content for search engines" },
              { icon: "🎵", name: "Audio Generator", description: "Generate music and sound effects" },
            ].map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-border bg-surface p-5 opacity-60 cursor-not-allowed"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-elevated text-lg">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text">{item.name}</h3>
                      <p className="text-sm text-text-muted">{item.description}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Badge variant="outline" size="sm">Coming Soon</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
