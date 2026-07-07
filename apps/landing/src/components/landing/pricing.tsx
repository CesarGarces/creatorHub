"use client";

import { m } from "framer-motion";
import { Check } from "lucide-react";
import { config } from "@/lib/config";

const plans = [
  {
    name: "Free",
    price: "$0",
    credits: "100 credits",
    perCredit: "Free 100 credits",
    description: "Start creating with 100 free credits",
    features: [
      "Access to free tools",
      "Basic providers included",
      "Community support",
    ],
    cta: "Get Started Free",
    ctaStyle: "border border-border hover:border-border-subtle text-text",
    popular: false,
    href: `${config.appUrl}/register`,
  },
  {
    name: "Pay as you go",
    price: "$10",
    credits: "1,000 credits",
    perCredit: "$1.0¢ per credit",
    description: "Buy credits anytime, no commitment",
    features: [
      "Access to all tools",
      "Basic providers included",
      "Community support",
      "30-day history",
    ],
    cta: "Buy Credits",
    ctaStyle: "border border-border hover:border-border-subtle text-text",
    popular: false,
    href: `${config.appUrl}/register`,
  },
  {
    name: "Starter",
    price: "$25",
    credits: "2,700 credits",
    perCredit: "$0.9¢ per credit",
    description: "Best value for getting started",
    features: [
      "All AI Standard providers",
      "Premium providers included",
      "Priority support",
      "Unlimited history",
      "API access",
      "Batch generation",
    ],
    cta: "Get Starter",
    ctaStyle: "bg-primary hover:bg-primary-hover text-white glow-primary",
    popular: true,
    href: `${config.appUrl}/register`,
  },
  {
    name: "Pro",
    price: "$50",
    credits: "6,000 credits",
    perCredit: "$0.8¢ per credit",
    description: "Maximum credits for power users",
    features: [
      "All AI Standard + Premium providers",
      "Everything in Starter",
      "Lowest cost per credit",
      "Dedicated support",
      "Custom integrations",
      "Analytics dashboard",
    ],
    cta: "Get Pro",
    ctaStyle: "border border-border hover:border-border-subtle text-text",
    popular: false,
    href: `${config.appUrl}/register`,
  },
];

const toolCosts = [
  {
    tool: "X Trend Research",
    cost: "~25 credits",
    description: "AI-powered trend analysis with sentiment insights",
  },
  {
    tool: "X Post Tweet",
    cost: "~15 credits",
    description: "Generate and publish tweets with RAG style",
  },
  {
    tool: "Thumbnail Generator",
    cost: "~10 credits",
    description: "Per generation",
  },
  {
    tool: "Video Generator",
    cost: "~50 credits",
    description: "Per video generated",
  },
  {
    tool: "Content Translator",
    cost: "~5 credits",
    description: "Per translation",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            Flexible credit system
          </h2>
          <p className="mt-4 text-text-muted max-w-xl mx-auto">
            Start with 100 free credits. Buy more anytime, no subscriptions.
            Prices are dynamically managed from the admin panel.
          </p>
        </m.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
          {plans.map((plan, i) => (
            <m.div
              key={plan.name}
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
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-text mb-1">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-text">
                    {plan.price}
                  </span>
                </div>
                <p className="text-sm text-text-muted mt-1">{plan.credits}</p>
                <p className="text-xs text-text-dim mt-0.5">{plan.perCredit}</p>
                <p className="text-sm text-text-muted mt-2">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check size={16} className="text-success mt-0.5 shrink-0" />
                    <span className="text-sm text-text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all text-center block ${plan.ctaStyle}`}
              >
                {plan.cta}
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
            Cost per tool
          </h3>
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            {toolCosts.map((item, i) => (
              <div
                key={item.tool}
                className={`flex items-center justify-between p-4 ${
                  i !== toolCosts.length - 1
                    ? "border-b border-border-subtle"
                    : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-text">
                    {item.tool}
                  </div>
                  <div className="text-xs text-text-muted">
                    {item.description}
                  </div>
                </div>
                <div className="text-sm font-semibold text-primary">
                  {item.cost}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-dim text-center mt-4">
            Costs may vary depending on the AI provider selected
          </p>
        </m.div>
      </div>
    </section>
  );
}
