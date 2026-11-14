"use client";

import { m } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";

// Names: showcase.styles.<id>
const styles = [
  { id: "cinematic", color: "from-purple-500 to-blue-500" },
  { id: "neon", color: "from-cyan-400 to-pink-500" },
  { id: "minimal", color: "from-gray-400 to-gray-600" },
  { id: "bold", color: "from-yellow-400 to-red-500" },
  { id: "retro", color: "from-green-400 to-purple-500" },
] as const;

export function ThumbnailShowcase() {
  const { t } = useI18n();
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
              {t("showcase.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-text text-balance mb-6">
              {t("showcase.title")}
            </h2>
            <p className="text-text-muted leading-relaxed mb-8">
              {t("showcase.description")}
            </p>

            <div className="space-y-3">
              {styles.map((style, i) => (
                <m.div
                  key={style.id}
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
                    {t(`showcase.styles.${style.id}`)}
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
                  {t("showcase.panelTitle")}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-text-muted mb-2">
                    {t("showcase.describeLabel")}
                  </label>
                  <div className="rounded-lg border border-border bg-bg p-3 text-sm text-text-muted">
                    {t("showcase.examplePrompt")}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-2">
                    {t("showcase.styleLabel")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {styles.slice(0, 3).map((style) => (
                      <span
                        key={style.id}
                        className="px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-elevated text-text-muted"
                      >
                        {t(`showcase.styles.${style.id}`)}
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
                        {t("showcase.variation", { number: n })}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="w-full py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                >
                  {t("showcase.generate")}
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
