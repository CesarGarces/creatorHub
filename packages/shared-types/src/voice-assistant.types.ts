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
  AssistantActionStatus,
} from "./assistant-action.types";

export const VOICE_ASSISTANT_TOOL_ID = "voice-assistant";
export const VOICE_ASSISTANT_NAME = "Robotina";

/**
 * A written reply costs 1 credit ("one shot"). A spoken reply costs the
 * seconds of speech at the TTS price instead (Admin → Voice, credits per
 * second — see `voiceCredits`). Voice input is billed apart by the STT
 * gateway, per second, like every voice button of the platform.
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
  /**
   * Speech stopped; the reply continues as text. `reason`: the balance
   * paid for no more seconds of her voice (`credits`), or the Free plan's
   * minutes ran out (`free-limit`).
   */
  | {
      type: "audio_error";
      error: string;
      reason?: "credits" | "free-limit";
    }
  /**
   * An action she runs (e.g. creating a calendar event): `running` when it
   * starts, then `done` or `failed` with its outcome — or
   * `needs_confirmation` (a delete waiting for the user's "yes"). Her words
   * about it follow as deltas/audio.
   */
  | {
      type: "action";
      id: string;
      name: string;
      status: AssistantActionStatus;
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
  /**
   * The reply failed. `code: "FREE_LIMIT_REACHED"`: the Free plan's minutes
   * with Robotina are used up (the app invites the user to upgrade).
   */
  | { type: "error"; status?: number; error: string; code?: string };

export type VoiceAssistantEventType = VoiceAssistantEvent["type"];
