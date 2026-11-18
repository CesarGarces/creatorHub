/**
 * Robotina — AI voice assistant (tool `voice-assistant`, ARCHITECTURE.md §14g).
 *
 * Wire contract between the API (`tools/voice-assistant/backend`) and the web
 * app (tool page + dashboard widget): the reply stream's events, the request
 * body and the prices shown before talking.
 */
import type { TTSLanguage } from "./tts.types";
import type {
  AssistantActionArgs,
  AssistantActionData,
  AssistantActionRecord,
} from "./assistant-action.types";

export const VOICE_ASSISTANT_TOOL_ID = "voice-assistant";
export const VOICE_ASSISTANT_NAME = "Robotina";

/**
 * Every reply costs 1 credit ("one shot"). A spoken reply costs 1 credit per
 * started minute of speech instead (`TTS_CREDITS_PER_MINUTE`) — so a reply
 * of up to a minute is 1 credit either way. Voice input is billed apart by
 * the STT gateway, like every voice button of the platform (1 credit/min).
 */
export const VOICE_ASSISTANT_REPLY_CREDITS = 1;

/** Longest message the assistant accepts (typed or transcribed). */
export const VOICE_ASSISTANT_MAX_MESSAGE_CHARS = 4000;

/** Previous messages sent to the model as context. */
export const VOICE_ASSISTANT_HISTORY_MESSAGES = 20;

export type VoiceAssistantRole = "user" | "assistant";

export interface VoiceAssistantMessage {
  id: string;
  role: VoiceAssistantRole;
  content: string;
  language: TTSLanguage;
  /** User: said with the voice. Assistant: answered with the voice. */
  spoken: boolean;
  /** Assistant: Aura-2 model that spoke it. */
  voice: string | null;
  /** Assistant: milliseconds of speech. */
  audioMs: number;
  creditsCharged: number;
  /** Assistant: the user interrupted the reply before it ended. */
  interrupted: boolean;
  /** Assistant: what she did during the reply (e.g. a calendar event). */
  actions: AssistantActionRecord[];
  createdAt: string;
}

export interface VoiceConversationSummary {
  id: string;
  title: string;
  language: TTSLanguage;
  lastMessage: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceConversationDetail extends VoiceConversationSummary {
  messages: VoiceAssistantMessage[];
}

/** Body of `POST /tools/voice-assistant/messages` (SSE reply). */
export interface VoiceAssistantRequest {
  /** Continue this conversation; omitted = start a new one. */
  conversationId?: string;
  content: string;
  /** The user spoke (STT): Robotina answers with her voice. */
  spoken: boolean;
  /** Text model (ModelMetadata.modelId) picked in the model settings. */
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Interface language — used only when the message's language is unclear. */
  languageHint?: TTSLanguage;
  /**
   * IANA time zone of the browser ("America/Bogota"): actions turn "tomorrow
   * at 3 pm" into the right instant. UTC when absent or unknown.
   */
  timeZone?: string;
}

/** Events of the reply stream (Server-Sent Events, `data: <json>`). */
export type VoiceAssistantEvent =
  | {
      type: "start";
      conversationId: string;
      userMessageId: string;
      /** Language Robotina answers (and speaks) in. */
      language: TTSLanguage;
      /** Aura-2 voice that will speak, `null` for a written reply. */
      voice: { model: string; name: string } | null;
      title: string;
    }
  | { type: "delta"; content: string }
  | {
      type: "audio";
      /** Order of the segment in the reply (0, 1, 2…). */
      index: number;
      mimeType: string;
      /** Base64 audio of one or more sentences. */
      data: string;
      durationMs: number;
      text: string;
    }
  /** Speech failed; the reply continues as text. */
  | { type: "audio_error"; error: string }
  /**
   * An action she runs (e.g. creating a calendar event): `running` when it
   * starts, then `done` or `failed` with its outcome. Her words about it
   * follow as deltas/audio.
   */
  | {
      type: "action";
      id: string;
      name: string;
      status: "running" | "done" | "failed";
      args: AssistantActionArgs;
      summary?: string;
      data?: AssistantActionData;
    }
  | {
      type: "done";
      messageId: string;
      content: string;
      language: TTSLanguage;
      audioMs: number;
      credits: number;
      balance: number;
    }
  | { type: "error"; status?: number; error: string };

export type VoiceAssistantEventType = VoiceAssistantEvent["type"];
