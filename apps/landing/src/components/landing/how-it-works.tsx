"use client";

import { m } from "framer-motion";
import { MessageSquare, Wand2, Image, Rocket } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";

// Texts: howItWorks.steps.<id>.title / .description
const steps = [
  { id: "describe", number: "01", icon: MessageSquare, color: "text-primary" },
  { id: "generate", number: "02", icon: Wand2, color: "text-accent" },
  { id: "refine", number: "03", icon: Image, color: "text-success" },
  { id: "publish", number: "04", icon: Rocket, color: "text-warning" },
] as const;

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <section className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">
            {t("howItWorks.eyebrow")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            {t("howItWorks.title")}
          </h2>
        </m.div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-primary/40 via-accent/40 to-success/40" />

          {steps.map((step, i) => (
            <m.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="relative z-10 mb-6">
                <div className="h-24 w-24 rounded-2xl border border-border bg-surface flex items-center justify-center">
                  <step.icon size={28} className={step.color} />
                </div>
              </div>
              <div className="text-xs font-mono text-text-dim mb-2">
                {step.number}
              </div>
              <h3 className="text-base font-semibold text-text mb-2">
                {t(`howItWorks.steps.${step.id}.title`)}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {t(`howItWorks.steps.${step.id}.description`)}
              </p>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  );
}
