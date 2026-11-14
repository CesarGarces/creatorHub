"use client";

import { m } from "framer-motion";
import { Bot, Youtube, Camera, Smartphone, MessageCircle } from "lucide-react";
import { config } from "@/lib/config";
import { useI18n } from "@/i18n/i18n-provider";

// Texts: agents.items.<id>.title / .description / .prompt / .capabilities.a-d
const agents = [
  { id: "x", icon: MessageCircle, status: "online" },
  { id: "youtube", icon: Youtube, status: "comingSoon" },
  { id: "instagram", icon: Camera, status: "comingSoon" },
  { id: "tiktok", icon: Smartphone, status: "comingSoon" },
] as const;

const CAPABILITY_KEYS = ["a", "b", "c", "d"] as const;

export function AgentsSection() {
  const { t } = useI18n();
  return (
    <section id="agents" className="py-24 border-t border-border-subtle">
      <div className="mx-auto max-w-7xl px-6">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-accent mb-3">
            {t("agents.eyebrow")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-text text-balance">
            {t("agents.title")}
          </h2>
          <p className="mt-4 text-text-muted max-w-2xl mx-auto">
            {t("agents.subtitle")}
          </p>
        </m.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {agents.map((agent, i) => {
            const title = t(`agents.items.${agent.id}.title`);
            return (
              <m.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-xl border border-border bg-surface overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="h-11 w-11 rounded-full bg-accent/10 flex items-center justify-center">
                        <agent.icon size={20} className="text-accent" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-surface" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text">
                        {title}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        <span className="text-[11px] text-success">
                          {t(`agents.status.${agent.status}`)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-text-muted leading-relaxed mb-4">
                    {t(`agents.items.${agent.id}.description`)}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {CAPABILITY_KEYS.map((cap) => (
                      <span
                        key={cap}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-surface-elevated text-text-muted border border-border-subtle"
                      >
                        {t(`agents.items.${agent.id}.capabilities.${cap}`)}
                      </span>
                    ))}
                  </div>

                  <div className="rounded-lg bg-bg border border-border-subtle p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot size={12} className="text-text-dim" />
                      <span className="text-[10px] text-text-dim font-medium">
                        {t("agents.samplePrompt")}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted italic leading-relaxed">
                      &ldquo;{t(`agents.items.${agent.id}.prompt`)}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="border-t border-border-subtle px-6 py-3">
                  <a
                    href={`${config.appUrl}/register`}
                    className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                  >
                    {t("agents.tryAgent", { agent: title })}
                  </a>
                </div>
              </m.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
