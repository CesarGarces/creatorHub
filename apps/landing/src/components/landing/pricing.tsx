"use client";

import { m } from "framer-motion";
import { Check } from "lucide-react";
import { config } from "@/lib/config";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";

// Texts: pricing.plans.<id>.name / .description / .cta / .features.<key>
const plans = [
  {
    id: "free",
    usd: 0,
    credits: 100,
    centsPerCredit: null,
    features: ["a", "b", "c"],
    ctaStyle: "border border-border hover:border-border-subtle text-text",
    popular: false,
    href: `${config.appUrl}/register`,
  },
  {
    id: "payg",
    usd: 10,
    credits: 1000,
    centsPerCredit: 1.0,
    features: ["a", "b", "c", "d"],
    ctaStyle: "border border-border hover:border-border-subtle text-text",
    popular: false,
    href: `${config.appUrl}/register`,
  },
  {
    id: "starter",
    usd: 25,
    credits: 2700,
    centsPerCredit: 0.9,
    features: ["a", "b", "c", "d", "e", "f"],
    ctaStyle: "bg-primary hover:bg-primary-hover text-white glow-primary",
    popular: true,
    href: `${config.appUrl}/register`,
  },
  {
    id: "pro",
    usd: 50,
    credits: 6000,
    centsPerCredit: 0.8,
    features: ["a", "b", "c", "d", "e", "f"],
    ctaStyle: "border border-border hover:border-border-subtle text-text",
    popular: false,
    href: `${config.appUrl}/register`,
  },
] as const;

// Texts: pricing.costs.<id>.tool / .description
const toolCosts = [
  { id: "xTrends", credits: 25 },
  { id: "xPost", credits: 15 },
  { id: "thumbnail", credits: 10 },
  { id: "video", credits: 50 },
  { id: "translator", credits: 5 },
] as const;

export function Pricing() {
  const { t, formatNumber } = useI18n();
  const formatUsd = (value: number) =>
    formatNumber(value, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  return (
    <section id="pricing" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">
            {t("pricing.eyebrow")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            {t("pricing.title")}
          </h2>
          <p className="mt-4 text-text-muted max-w-xl mx-auto">
            {t("pricing.subtitle")}
          </p>
        </m.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
          {plans.map((plan, i) => (
            <m.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`relative rounded-xl border bg-surface p-6 flex flex-col ${
                plan.popular
                  ? "border-primary/50 glow-primary"
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-semibold text-white bg-primary rounded-full">
                  {t("pricing.mostPopular")}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-text mb-1">
                  {t(`pricing.plans.${plan.id}.name`)}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-text">
                    {formatUsd(plan.usd)}
                  </span>
                </div>
                <p className="text-sm text-text-muted mt-1">
                  {t("common.credits", { count: plan.credits })}
                </p>
                <p className="text-xs text-text-dim mt-0.5">
                  {plan.centsPerCredit === null
                    ? t("pricing.plans.free.perCredit")
                    : t("pricing.perCredit", {
                        amount: formatNumber(plan.centsPerCredit, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        }),
                      })}
                </p>
                <p className="text-sm text-text-muted mt-2">
                  {t(`pricing.plans.${plan.id}.description`)}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check size={16} className="text-success mt-0.5 shrink-0" />
                    <span className="text-sm text-text-muted">
                      {t(
                        `pricing.plans.${plan.id}.features.${feature}` as TranslationKey,
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all text-center block ${plan.ctaStyle}`}
              >
                {t(`pricing.plans.${plan.id}.cta`)}
              </a>
            </m.div>
          ))}
        </div>

        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <h3 className="text-xl font-semibold text-text text-center mb-6">
            {t("pricing.costTitle")}
          </h3>
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            {toolCosts.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 ${
                  i !== toolCosts.length - 1
                    ? "border-b border-border-subtle"
                    : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-text">
                    {t(`pricing.costs.${item.id}.tool`)}
                  </div>
                  <div className="text-xs text-text-muted">
                    {t(`pricing.costs.${item.id}.description`)}
                  </div>
                </div>
                <div className="text-sm font-semibold text-primary">
                  {t("common.approxCredits", { count: item.credits })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-dim text-center mt-4">
            {t("pricing.costNote")}
          </p>
        </m.div>
      </div>
    </section>
  );
}
