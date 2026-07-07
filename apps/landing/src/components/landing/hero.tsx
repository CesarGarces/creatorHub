"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ArrowRight, Play, X, Image, MessageCircle } from "lucide-react";
import { config } from "@/lib/config";

export function Hero() {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.12)_0%,_transparent_60%)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] text-balance max-w-4xl">
            One Workspace.{" "}
            <span className="gradient-text">Infinite Content.</span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-text-muted max-w-2xl text-balance">
            Create thumbnails, videos, and translate content across languages
            using AI tools and agents.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <a
              href={`${config.appUrl}/register`}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl transition-all glow-primary hover:glow-primary-strong"
            >
              Start Creating Free
              <ArrowRight size={16} />
            </a>
            <button
              type="button"
              onClick={() => setShowVideo(true)}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-text-muted hover:text-text border border-border hover:border-border-subtle rounded-xl transition-colors"
            >
              <Play size={16} />
              Watch Demo
            </button>
          </div>
        </m.div>

        <m.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-16 relative"
        >
          <div className="rounded-2xl border border-border bg-surface p-1 glow-primary">
            <div className="rounded-xl bg-surface-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-error/60" />
                <div className="h-3 w-3 rounded-full bg-warning/60" />
                <div className="h-3 w-3 rounded-full bg-success/60" />
                <div className="ml-4 text-xs text-text-dim">
                  Creator Hub Dashboard
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MockToolCard
                  title="Thumbnail Generator"
                  description="AI-powered thumbnails for YouTube, Twitch & TikTok"
                  color="primary"
                />
                <MockAgentCard
                  title="X (Twitter) Agent"
                  status="online"
                  capabilities={[
                    "X Post Generation",
                    "AI Analysis",
                    "Trend Research",
                  ]}
                />
                <MockStatsCard />
              </div>
            </div>
          </div>
          <div className="absolute -inset-4 bg-primary/5 blur-3xl rounded-full" />
        </m.div>
      </div>

      <AnimatePresence>
        {showVideo && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowVideo(false)}
          >
            <m.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowVideo(false)}
                className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              <div className="rounded-2xl overflow-hidden border border-border glow-primary">
                <video
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="w-full aspect-video rounded-xl"
                >
                  <source
                    src="https://cesargarces.com/Assets-platform/demo_creator_hub.mp4"
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function MockToolCard({
  title,
  description,
  color,
}: {
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center mb-3">
        <Image size={20} className="text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-muted">{description}</p>
    </div>
  );
}

function MockAgentCard({
  title,
  status,
  capabilities,
}: {
  title: string;
  status: string;
  capabilities: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center mb-3">
        <MessageCircle size={20} className="text-accent" />
      </div>
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-muted">{capabilities.join(", ")}</p>
    </div>
  );
}

function MockStatsCard() {
  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <h3 className="text-sm font-semibold text-text mb-3">This Week</h3>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-muted">Thumbnails</span>
          <span className="text-xs font-medium text-text">24</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-muted">Videos</span>
          <span className="text-xs font-medium text-text">8</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-muted">Translations</span>
          <span className="text-xs font-medium text-text">48</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-primary to-accent" />
        </div>
      </div>
    </div>
  );
}
