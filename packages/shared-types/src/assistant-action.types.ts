/**
 * Assistant actions (ARCHITECTURE.md §14g "Actions").
 *
 * Things the AI assistant can *do* for the user, not just say — e.g. put a
 * session in the Content Planner. Tools register their actions in the
 * `AssistantActionRegistry` (`@creator-hub/tool-sdk`) at startup; Robotina
 * discovers them at runtime and lists them in her prompt, so a new tool
 * brings new abilities without changing the assistant (Open/Closed, like
 * the Tool Registry).
 */

export type AssistantActionParameterType =
  | "string"
  | "integer"
  | "boolean"
  /** `YYYY-MM-DD` in the user's time zone. */
  | "date"
  /** `HH:mm`, 24-hour clock, in the user's time zone. */
  | "time";

export interface AssistantActionParameter {
  name: string;
  type: AssistantActionParameterType;
  description: string;
  required: boolean;
  /** Allowed values (strings or integers). */
  enum?: ReadonlyArray<string | number>;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface AssistantActionDefinition {
  /** `<area>.<verb>`, e.g. "calendar.create_event". */
  name: string;
  /** Tool that owns the action (ToolManifest.id). */
  toolId: string;
  /** What it does and when to use it — read by the model. */
  description: string;
  parameters: AssistantActionParameter[];
  /** Changes the user's data (the model must have every detail first). */
  mutates: boolean;
  /**
   * A sample request and the arguments it maps to — shown to the model as
   * a worked example (models follow the format far more reliably).
   */
  example?: { request: string; args: AssistantActionArgs };
}

export type AssistantActionArgs = Record<string, string | number | boolean>;

/** Who asks, and where/when they are. */
export interface AssistantActionContext {
  userId: string;
  /** IANA time zone of the user's browser ("America/Bogota"). */
  timeZone: string;
  now: Date;
  /** Language of the conversation ("en" | "es" | "pt"). */
  language: string;
}

export interface AssistantActionResult {
  ok: boolean;
  /** Plain-English outcome for the model (it tells the user). */
  summary: string;
  /** Structured outcome for the UI card (`kind` selects the card). */
  data?: AssistantActionData;
}

/** A calendar session as shown on action cards. */
export interface AssistantCalendarEvent {
  id: string;
  title: string;
  type: string;
  startAt: string;
  endAt: string;
  status?: string;
}

export type AssistantActionData =
  | {
      kind: "calendar-event";
      event: AssistantCalendarEvent;
      /** Sessions it overlaps (a warning, never a block). */
      conflicts: AssistantCalendarEvent[];
      /** Planner page on the event's week. */
      url: string;
    }
  | {
      kind: "calendar-agenda";
      /** First day listed (`YYYY-MM-DD`, user's zone) and number of days. */
      from: string;
      days: number;
      events: AssistantCalendarEvent[];
      url: string;
    };

/** An action as stored with the assistant's reply and shown in the chat. */
export interface AssistantActionRecord {
  id: string;
  name: string;
  args: AssistantActionArgs;
  status: "running" | "done" | "failed";
  summary?: string;
  data?: AssistantActionData;
}

/** Most actions the assistant may run in a single reply. */
export const ASSISTANT_MAX_ACTIONS_PER_REPLY = 3;
