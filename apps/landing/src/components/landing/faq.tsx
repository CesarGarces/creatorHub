"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What is Creator Hub?",
    answer:
      "Creator Hub is an AI-powered platform for content creators. It combines AI tools (thumbnail generation, video generation, content translation) with specialized AI agents (YouTube, Twitch, TikTok) to help you create, optimize, and publish content faster.",
  },
  {
    question: "Do I need design skills to use the Thumbnail Generator?",
    answer:
      "No. Just describe what you want in plain language and the AI generates professional thumbnails. You can choose from pre-made styles or describe your own vision. No design skills required.",
  },
  {
    question: "What AI models do you use?",
    answer:
      "We use a combination of state-of-the-art models including Wan AI for video generation, and various LLM providers for text and translation. We're constantly adding new models as they become available.",
  },
  {
    question: "How does the credit system work?",
    answer:
      "You start with 100 free credits. Each tool costs a different amount: Thumbnail Generator (~10 credits), Video Generator (~50 credits), Content Translator (~5 credits). You can buy more credits anytime with no subscription required.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Since we use a credit-based system with no subscriptions, there's nothing to cancel. Buy credits when you need them, use them at your own pace.",
  },
  {
    question: "What platforms do the AI Agents support?",
    answer:
      "Our AI Agents are specialized for YouTube, Twitch, and TikTok. Each agent understands platform-specific best practices and helps you optimize your content for maximum reach and engagement.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold text-text">
            Frequently asked questions
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-surface overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex items-center justify-between w-full p-5 text-left"
              >
                <span className="text-sm font-medium text-text pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-text-muted shrink-0 transition-transform duration-200 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 text-sm text-text-muted leading-relaxed border-t border-border-subtle pt-4">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
