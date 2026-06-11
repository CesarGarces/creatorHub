"use client";

import { motion } from "framer-motion";
import { Bot, Youtube, Tv, Smartphone } from "lucide-react";
import { config } from "@/lib/config";

const agents = [
  {
    icon: Youtube,
    title: "YouTube Agent",
    status: "online" as const,
    description: "Optimize videos for YouTube. Get title suggestions, SEO tags, and thumbnail ideas.",
    capabilities: ["Title Generation", "SEO Tags", "Content Strategy", "Competitor Analysis"],
    prompt: "Analyze my latest video and suggest improvements for better reach...",
  },
  {
    icon: Tv,
    title: "Twitch Agent",
    status: "online" as const,
    description: "Grow your Twitch channel. Stream scheduling, raid suggestions, and chat engagement.",
    capabilities: ["Stream Planning", "Chat Games", "Raid Strategy", "Clip Highlights"],
    prompt: "Help me plan my streaming schedule for maximum viewership...",
  },
  {
    icon: Smartphone,
    title: "TikTok Agent",
    status: "online" as const,
    description: "Create viral TikTok content. Trending sounds, hook formulas, and posting strategy.",
    capabilities: ["Hook Writing", "Trend Analysis", "Posting Schedule", "Hashtag Research"],
    prompt: "Generate 10 viral hooks for my niche in the fitness category...",
  },
];

export function AgentsSection() {
  return (
    <section id="agents" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-accent mb-3">AI Agents</p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            Your AI content team
          </h2>
          <p className="mt-4 text-text-muted max-w-2xl mx-auto">
            Specialized AI agents that understand your platform and help you grow.
            Each agent is trained on platform-specific best practices.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-xl border border-border bg-surface overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="h-11 w-11 rounded-full bg-accent/10 flex items-center justify-center">
                      <agent.icon size={20} className="text-accent" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-surface" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text">{agent.title}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      <span className="text-[11px] text-success capitalize">{agent.status}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-text-muted leading-relaxed mb-4">{agent.description}</p>

                <div className="flex flex-wrap gap-1.5 mb-5">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-surface-elevated text-text-muted border border-border-subtle"
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                <div className="rounded-lg bg-bg border border-border-subtle p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={12} className="text-text-dim" />
                    <span className="text-[10px] text-text-dim font-medium">Sample Prompt</span>
                  </div>
                  <p className="text-xs text-text-muted italic leading-relaxed">
                    &ldquo;{agent.prompt}&rdquo;
                  </p>
                </div>
              </div>

              <div className="border-t border-border-subtle px-6 py-3">
                <a
                  href={`${config.appUrl}/register`}
                  className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  Try {agent.title}
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
