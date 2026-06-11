"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for trying out Creator Hub",
    features: [
      "10 thumbnail generations / month",
      "1 AI agent access",
      "Basic styles only",
      "Community support",
    ],
    cta: "Get Started",
    ctaStyle: "border border-border hover:border-border-subtle text-text",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For creators who publish regularly",
    features: [
      "Unlimited thumbnail generations",
      "All AI agents",
      "All styles & custom styles",
      "Script Writer access",
      "Stream Games",
      "Priority support",
      "API access",
    ],
    cta: "Start Pro Trial",
    ctaStyle: "bg-primary hover:bg-primary-hover text-white glow-primary",
    popular: true,
  },
  {
    name: "Team",
    price: "$49",
    period: "/month",
    description: "For teams and agencies",
    features: [
      "Everything in Pro",
      "5 team seats",
      "Shared workspace",
      "Brand kit & templates",
      "Analytics dashboard",
      "Dedicated support",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    ctaStyle: "border border-border hover:border-border-subtle text-text",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-text-muted max-w-xl mx-auto">
            Start free, upgrade when you&apos;re ready. No hidden fees.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
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
                <h3 className="text-lg font-semibold text-text mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-text">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-text-muted">{plan.period}</span>
                  )}
                </div>
                <p className="text-sm text-text-muted mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check size={16} className="text-success mt-0.5 shrink-0" />
                    <span className="text-sm text-text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all ${plan.ctaStyle}`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
