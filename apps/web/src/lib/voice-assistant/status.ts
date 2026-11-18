import type { TranslationKey } from "@/i18n/translate";
import type { OrbState } from "./orb";

/** What the orb's status line says in each state. */
export const STATUS_KEYS: Record<OrbState, TranslationKey> = {
  idle: "voiceAssistant.status.idle",
  listening: "voiceAssistant.status.listening",
  thinking: "voiceAssistant.status.thinking",
  speaking: "voiceAssistant.status.speaking",
};

/** Accessible name of the orb button: what a tap does in each state. */
export const ORB_ACTION_KEYS: Record<OrbState, TranslationKey> = {
  idle: "voiceAssistant.orb.talk",
  listening: "voiceAssistant.orb.finish",
  thinking: "voiceAssistant.orb.interrupt",
  speaking: "voiceAssistant.orb.interrupt",
};
