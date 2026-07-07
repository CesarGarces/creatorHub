"use client";

import { m } from "framer-motion";
import { Image, Film, Languages, ArrowRight } from "lucide-react";

const tools = [
  {
    icon: Image,
    title: "Thumbnail Generator",
    description:
      "Generate professional thumbnails with AI. Supports multiple styles, custom prompts, negative prompts, and adjustable dimensions. Perfect for YouTube, Twitch, and TikTok.",
    color: "text-primary",
    bgColor: "bg-primary/10",
    credits: "~10 credits",
  },
  {
    icon: Film,
    title: "Video Generator",
    description:
      "Create videos with AI using Wan AI models. Supports text-to-video and image-to-video, multiple aspect ratios (16:9, 9:16, 1:1). Ideal for short-form and long-form content.",
    color: "text-accent",
    bgColor: "bg-accent/10",
    credits: "50 credits",
  },
  {
    icon: Languages,
    title: "Content Translator",
    description:
      "Translate your content to multiple languages with AI precision. Expand your global audience with natural, contextual translations in seconds.",
    color: "text-success",
    bgColor: "bg-success/10",
    credits: "~5 credits",
  },
];

export function ToolsSection() {
  return (
    <section id="tools" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">AI Tools</p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            Real tools for real creators
          </h2>
          <p className="mt-4 text-text-muted max-w-2xl mx-auto">
            Each tool is designed to solve specific content creation problems,
            powered by state-of-the-art AI models.
          </p>
        </m.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, i) => (
            <m.div
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
                <span className="px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-border-subtle text-text-muted">
                  {tool.credits}
                </span>
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
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
