"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";

const agents = [
  {
    id: "youtube",
    name: "Video Creator Agent",
    description: "Plan, script, and optimize your video content with AI",
    icon: "🎬",
    color: "bg-primary-light",
    hoverColor: "hover:border-primary/30 hover:shadow-primary/5",
    badge: "primary" as const,
    badgeText: "AI Powered",
    lastUsed: "2 hours ago",
  },
  {
    id: "twitch",
    name: "Streaming Agent",
    description: "Manage your live content, overlays, and audience engagement",
    icon: "📡",
    color: "bg-accent-light",
    hoverColor: "hover:border-accent/30 hover:shadow-accent/5",
    badge: "accent" as const,
    badgeText: "Live",
    lastUsed: "1 day ago",
  },
  {
    id: "content",
    name: "Content Agent",
    description: "Repurpose and distribute your content across all platforms",
    icon: "🧠",
    color: "bg-secondary-light",
    hoverColor: "hover:border-secondary/30 hover:shadow-secondary/5",
    badge: "secondary" as const,
    badgeText: "Multi-Platform",
    lastUsed: "Never",
  },
];

export default function AgentsPage() {
  const router = useRouter();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Agents" },
        ]}
      />
      <div className="p-6 space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-text">Agents</h1>
          <p className="mt-1 text-text-muted">
            AI assistants that help you create content
          </p>
        </div>

        {/* Active Agents */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">
            Your Agents
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`group cursor-pointer rounded-xl border border-border bg-surface p-6 transition-all duration-200 ${agent.hoverColor} hover:shadow-lg`}
                onClick={() => router.push(`/agents/${agent.id}`)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-xl ${agent.color} text-3xl transition-colors`}
                  >
                    {agent.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-text">{agent.name}</h3>
                    <p className="mt-1 text-sm text-text-muted line-clamp-2">
                      {agent.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant={agent.badge} size="sm">
                        {agent.badgeText}
                      </Badge>
                      <span className="text-xs text-text-dim">
                        Last used: {agent.lastUsed}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Available Agents */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">
            Available Agents
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "📊",
                name: "Analytics Agent",
                description: "Track and analyze your content performance",
              },
              {
                icon: "🎯",
                name: "Growth Agent",
                description: "Strategies to grow your audience",
              },
            ].map((agent) => (
              <div
                key={agent.name}
                className="rounded-xl border border-border bg-surface p-6 opacity-60"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-elevated text-3xl">
                    {agent.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">{agent.name}</h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {agent.description}
                    </p>
                    <Badge variant="outline" size="sm" className="mt-3">
                      Coming Soon
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
