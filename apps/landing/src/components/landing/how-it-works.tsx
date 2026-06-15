"use client";

import { motion } from "framer-motion";
import { MessageSquare, Wand2, Image, Rocket } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Describe What You Need",
    description: "Tell the AI what you want to create in plain language.",
    icon: MessageSquare,
    color: "text-primary",
  },
  {
    number: "02",
    title: "AI Generates It",
    description: "Our AI tools and agents build your content in seconds.",
    icon: Wand2,
    color: "text-accent",
  },
  {
    number: "03",
    title: "Refine & Perfect",
    description: "Tweak, regenerate, and customize until it's exactly right.",
    icon: Image,
    color: "text-success",
  },
  {
    number: "04",
    title: "Ship & Publish",
    description: "Download, publish, or send directly to your platform.",
    icon: Rocket,
    color: "text-warning",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            From idea to content in seconds
          </h2>
        </motion.div>

        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-primary/40 via-accent/40 to-success/40" />

          {steps.map((step, i) => (
            <motion.div
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
                {step.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
