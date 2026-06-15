"use client";

import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Alex Rivera",
    role: "YouTuber · 500K subs",
    text: "Creator Hub cut my thumbnail creation time from hours to minutes. The AI understands exactly what works.",
    avatar: "AR",
  },
  {
    name: "Sarah Chen",
    role: "Twitch Partner",
    text: "The stream games agent keeps my chat engaged for hours. My average watch time doubled.",
    avatar: "SC",
  },
  {
    name: "Marcus Johnson",
    role: "TikTok Creator · 2M followers",
    text: "I generate scripts, hooks, and thumbnails all in one place. It's my entire content workflow.",
    avatar: "MJ",
  },
];

const stats = [
  { value: "10,000+", label: "Creators" },
  { value: "2M+", label: "Assets Generated" },
  { value: "500K+", label: "AI Queries" },
  { value: "99.9%", label: "Uptime" },
];

export function SocialProof() {
  return (
    <section className="py-20 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
        >
          <p className="text-sm text-text-muted mb-8">
            Trusted by 10,000+ creators worldwide
          </p>

          <div className="flex flex-wrap justify-center gap-8 md:gap-16 mb-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-text">
                  {stat.value}
                </div>
                <div className="text-sm text-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-xl border border-border bg-surface p-6 text-left"
              >
                <p className="text-sm text-text-muted mb-4 leading-relaxed">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text">
                      {t.name}
                    </div>
                    <div className="text-xs text-text-dim">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
