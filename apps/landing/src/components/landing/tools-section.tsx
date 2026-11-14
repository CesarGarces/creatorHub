"use client";

import { m } from "framer-motion";
import { Image, Film, Languages, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";

// Texts: tools.items.<id>.title / .description
const tools = [
  {
    id: "thumbnail",
    icon: Image,
    color: "text-primary",
    bgColor: "bg-primary/10",
    credits: 10,
    approximate: true,
  },
  {
    id: "video",
    icon: Film,
    color: "text-accent",
    bgColor: "bg-accent/10",
    credits: 50,
    approximate: false,
  },
  {
    id: "translator",
    icon: Languages,
    color: "text-success",
    bgColor: "bg-success/10",
    credits: 5,
    approximate: true,
  },
] as const;

export function ToolsSection() {
  const { t } = useI18n();
  return (
    <section id="tools" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">
            {t("tools.eyebrow")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            {t("tools.title")}
          </h2>
          <p className="mt-4 text-text-muted max-w-2xl mx-auto">
            {t("tools.subtitle")}
          </p>
        </m.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, i) => (
            <m.div
              key={tool.id}
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
                  {t(
                    tool.approximate
                      ? "common.approxCredits"
                      : "common.credits",
                    {
                      count: tool.credits,
                    },
                  )}
                </span>
              </div>
              <h3 className="text-base font-semibold text-text mb-2">
                {t(`tools.items.${tool.id}.title`)}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed mb-4">
                {t(`tools.items.${tool.id}.description`)}
              </p>
              <div className="flex items-center gap-1.5 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <span>{t("tools.explore")}</span>
                <ArrowRight size={14} />
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
