"use client";

import { m } from "framer-motion";
import { Sparkles } from "lucide-react";

const styles = [
  { name: "Cinematic", color: "from-purple-500 to-blue-500" },
  { name: "Neon Glow", color: "from-cyan-400 to-pink-500" },
  { name: "Minimal", color: "from-gray-400 to-gray-600" },
  { name: "Bold & Bright", color: "from-yellow-400 to-red-500" },
  { name: "Retro Gaming", color: "from-green-400 to-purple-500" },
];

export function ThumbnailShowcase() {
  return (
    <section className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <m.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-sm font-medium text-primary mb-3">
              Thumbnail Generator
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-text text-balance mb-6">
              Thumbnails that get clicks
            </h2>
            <p className="text-text-muted leading-relaxed mb-8">
              Generate stunning, click-worthy thumbnails in seconds. Choose from
              multiple AI styles or describe your own. No design skills needed.
            </p>

            <div className="space-y-3">
              {styles.map((style, i) => (
                <m.div
                  key={style.name}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div
                    className={`h-8 w-8 rounded-lg bg-gradient-to-br ${style.color}`}
                  />
                  <span className="text-sm font-medium text-text">
                    {style.name}
                  </span>
                </m.div>
              ))}
            </div>
          </m.div>

          <m.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles size={16} className="text-primary" />
                <span className="text-sm font-medium text-text">
                  Generate Thumbnail
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-text-muted mb-2">
                    Describe your thumbnail
                  </label>
                  <div className="rounded-lg border border-border bg-bg p-3 text-sm text-text-muted">
                    Epic gaming thumbnail with neon lights, dramatic lighting,
                    bold text overlay...
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-2">
                    Style
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {styles.slice(0, 3).map((style) => (
                      <span
                        key={style.name}
                        className="px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-elevated text-text-muted"
                      >
                        {style.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="aspect-video rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center"
                    >
                      <span className="text-[10px] text-text-dim">
                        Variation {n}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="w-full py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                >
                  Generate
                </button>
              </div>
            </div>
            <div className="absolute -inset-4 bg-accent/5 blur-3xl rounded-full -z-10" />
          </m.div>
        </div>
      </div>
    </section>
  );
}
