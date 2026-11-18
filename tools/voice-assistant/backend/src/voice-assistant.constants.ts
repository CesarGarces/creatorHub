import {
  VOICE_ASSISTANT_HISTORY_MESSAGES,
  VOICE_ASSISTANT_MAX_MESSAGE_CHARS,
  VOICE_ASSISTANT_NAME,
  VOICE_ASSISTANT_REPLY_CREDITS,
  VOICE_ASSISTANT_TOOL_ID,
} from "@creator-hub/shared-types";

export {
  VOICE_ASSISTANT_HISTORY_MESSAGES,
  VOICE_ASSISTANT_MAX_MESSAGE_CHARS,
  VOICE_ASSISTANT_NAME,
  VOICE_ASSISTANT_REPLY_CREDITS,
  VOICE_ASSISTANT_TOOL_ID,
};

export const TEXT_TASK = "text-generation";

/** Conversation titles: the first message, shortened. */
export const MAX_TITLE_CHARS = 60;

/** Model settings accepted from the client (same ranges as the settings panel, with room). */
export const MIN_MAX_TOKENS = 50;
export const MAX_MAX_TOKENS = 4000;
export const DEFAULT_MAX_TOKENS = 300;
export const DEFAULT_TEMPERATURE = 0.7;
