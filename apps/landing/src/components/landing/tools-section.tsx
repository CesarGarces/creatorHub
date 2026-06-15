"use client";

import { motion } from "framer-motion";
import {
  Image,
  MessageSquare,
  Gamepad2,
  Film,
  Layers,
  ArrowRight,
} from "lucide-react";

const tools = [
  {
    icon: Image,
    title: "Thumbnail Generator",
    description:
      "AI-powered thumbnails for YouTube, Twitch & TikTok. Multiple styles, instant generation.",
    color: "text-primary",
    bgColor: "bg-primary/10",
    badge: "Popular",
    badgeColor: "bg-primary/20 text-primary",
  },
  {
    icon: MessageSquare,
    title: "Script Writer",
    description:
      "Generate video scripts, hooks, and outlines tailored to your niche and audience.",
    color: "text-accent",
    bgColor: "bg-accent/10",
    badge: "New",
    badgeColor: "bg-accent/20 text-accent",
  },
  {
    icon: Gamepad2,
    title: "Stream Games",
    description:
      "Interactive chat games for Twitch and YouTube Live. Keep your audience engaged.",
    color: "text-success",
    bgColor: "bg-success/10",
    badge: null,
    badgeColor: "",
  },
  {
    icon: Film,
    title: "Clip Generator",
    description:
      "Automatically extract the best moments from your streams into shareable clips.",
    color: "text-warning",
    bgColor: "bg-warning/10",
    badge: null,
    badgeColor: "",
  },
  {
    icon: Layers,
    title: "Overlay Builder",
    description:
      "Design custom stream overlays, alerts, and on-screen elements with AI assistance.",
    color: "text-error",
    bgColor: "bg-error/10",
    badge: "Coming Soon",
    badgeColor: "bg-error/20 text-error",
  },
];

export function ToolsSection() {
  return (
    <section id="tools" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">AI Tools</p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            Everything you need to create
          </h2>
          <p className="mt-4 text-text-muted max-w-2xl mx-auto">
            A growing toolkit designed for content creators. Each tool is
            powered by state-of-the-art AI models.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group relative rounded-xl border border-border bg-surface p-6 hover:border-primary/30 transition-all cursor-pointer card-glow"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`h-12 w-12 rounded-xl ${tool.bgColor} flex items-center justify-center`}
                >
                  <tool.icon size={22} className={tool.color} />
                </div>
                {tool.badge && (
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-medium rounded-full ${tool.badgeColor}`}
                  >
                    {tool.badge}
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-text mb-2">
                {tool.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed mb-4">
                {tool.description}
              </p>
              <div className="flex items-center gap-1.5 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Explore</span>
                <ArrowRight size={14} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
