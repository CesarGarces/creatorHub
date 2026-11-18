"use client";

import { useId } from "react";
import Link from "next/link";
import { Switch, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { useRobotina } from "@/hooks/use-robotina";
import { useVoiceAssistantStore } from "@/store/voice-assistant.store";
import { RobotinaOrb } from "@/components/voice-assistant/robotina-orb";
import { AssistantActionCard } from "@/components/voice-assistant/assistant-action-card";
import { FreeMinutesNotice } from "@/components/voice-assistant/free-minutes-notice";
import { ORB_ACTION_KEYS, STATUS_KEYS } from "@/lib/voice-assistant/status";
import { WidgetHeader } from "../widget-header";

function lastAssistant<M extends { role: string }>(
  messages: readonly M[],
): M | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "assistant") return messages[i];
  }
  return undefined;
}

/**
 * "Robotina": the AI voice assistant on the dashboard. A glowing orb with
 * floating particles — tap it and talk. While you speak its rim waves with
 * your voice; while she answers (out loud, Deepgram Aura-2, in your
 * language) it waves with hers. Conversation mode listens again after each
 * answer. "Open chat" continues the same conversation in the tool.
 *
 * When she acts (e.g. creates a calendar session), a compact card shows it.
 * Loads no data on mount: voice input uses the STT socket only when tapped.
 */
export function VoiceAssistantWidget() {
  const { t } = useI18n();
  const robotina = useRobotina();
  const handsFree = useVoiceAssistantStore((s) => s.handsFree);
  const setHandsFree = useVoiceAssistantStore((s) => s.setHandsFree);
  const lastReply = useVoiceAssistantStore(
    (s) => lastAssistant(s.messages)?.content ?? "",
  );
  // Her latest action (e.g. the session she just put in the calendar).
  const lastAction = useVoiceAssistantStore((s) =>
    lastAssistant(s.messages)?.actions?.at(-1),
  );
  const switchId = useId();
  const { state } = robotina;
  const active = state !== "idle";

  const caption =
    robotina.liveTranscript ||
    (state === "listening" ? "" : lastReply) ||
    t("voiceAssistant.widget.hint");

  return (
    <section>
      <WidgetHeader
        title={t("dashboard.widgets.voiceAssistant.name")}
        action={
          <Link
            href="/tools/voice-assistant"
            className="text-xs text-primary hover:text-primary-hover transition-colors pointer-coarse:py-3"
          >
            {t("voiceAssistant.openChat")}
          </Link>
        }
      />
      <div className="relative flex min-h-[320px] flex-col items-center overflow-hidden rounded-xl border border-border bg-surface px-4 pb-3 pt-4 sm:px-5">
        {/* Soft backdrop glow under the orb. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.14),transparent_70%)]"
        />
        <button
          type="button"
          onClick={() => void robotina.toggle()}
          aria-label={t(ORB_ACTION_KEYS[state])}
          data-robotina-orb
          disabled={robotina.limitReached && state === "idle"}
          className="relative rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transform-none"
        >
          <RobotinaOrb state={state} getLevel={robotina.getLevel} size={168} />
        </button>

        <p
          role="status"
          aria-live="polite"
          className="relative mt-1 text-sm font-medium text-text"
        >
          {t(robotina.activity ?? STATUS_KEYS[state])}
        </p>
        <p className="relative mt-1 line-clamp-2 min-h-10 max-w-sm text-center text-xs text-text-muted">
          {caption}
        </p>
        {(lastAction?.status === "done" ||
          lastAction?.status === "needs_confirmation") && (
          <AssistantActionCard
            action={lastAction}
            compact
            className="relative mt-2 w-full max-w-sm"
          />
        )}
        {robotina.error && (
          <p
            role="alert"
            className="relative mt-1 text-center text-xs text-error"
          >
            {robotina.error}
          </p>
        )}
        {/* Free plan: minutes left, or the invitation to upgrade. */}
        <FreeMinutesNotice
          allowance={robotina.allowance}
          compact
          className="relative mt-2 w-full max-w-sm"
        />

        <div className="relative mt-auto flex w-full flex-wrap items-center justify-between gap-2 pt-3">
          <div className="flex min-h-11 items-center gap-2">
            <Switch
              id={switchId}
              checked={handsFree}
              onCheckedChange={setHandsFree}
              aria-describedby={`${switchId}-hint`}
            />
            <label htmlFor={switchId} className="text-xs text-text-muted">
              {t("voiceAssistant.handsFree")}
            </label>
            <span id={`${switchId}-hint`} className="sr-only">
              {t("voiceAssistant.handsFreeHint")}
            </span>
          </div>
          {active ? (
            <button
              type="button"
              onClick={robotina.stop}
              className={cn(
                "min-h-11 rounded-lg border border-border px-3 text-xs font-medium text-text-muted",
                "hover:border-error/40 hover:text-error transition-colors",
              )}
            >
              {t("voiceAssistant.stop")}
            </button>
          ) : (
            <span className="text-[11px] text-text-dim">
              {t("voiceAssistant.pricingShort", {
                stt: robotina.sttCreditsPerSecond,
                tts: robotina.ttsCreditsPerSecond,
              })}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
