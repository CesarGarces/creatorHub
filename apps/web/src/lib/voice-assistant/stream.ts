import type {
  VoiceAssistantEvent,
  VoiceAssistantRequest,
} from "@creator-hub/shared-types";
import { getAccessToken } from "@/lib/cookie";

/**
 * Client of `POST /tools/voice-assistant/messages`: Robotina's reply as
 * Server-Sent Events (text deltas, Aura-2 audio segments, done/error).
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type DoneEvent = Extract<VoiceAssistantEvent, { type: "done" }>;

export class AssistantStreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** e.g. FREE_LIMIT_REACHED (the Free plan's minutes are used up). */
    readonly code?: string,
  ) {
    super(message);
    this.name = "AssistantStreamError";
  }
}

/** Parses complete `data: …` events from a buffer; returns the unparsed rest. */
export function parseSseEvents(buffer: string): {
  events: VoiceAssistantEvent[];
  rest: string;
} {
  const events: VoiceAssistantEvent[] = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as VoiceAssistantEvent);
    } catch {
      // ignore malformed events
    }
  }
  return { events, rest };
}

/**
 * Sends a message and calls `onEvent` for each event of the reply. Resolves
 * with the final `done` event; HTTP and streamed errors reject with the
 * server's message (`AssistantStreamError`). Aborting the signal stops the
 * reply on the server too (nothing more is generated or charged).
 */
export async function streamAssistantReply(
  request: VoiceAssistantRequest,
  onEvent: (event: VoiceAssistantEvent) => void,
  signal?: AbortSignal,
): Promise<DoneEvent> {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}/tools/voice-assistant/messages`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok || !response.body) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    try {
      const body = (await response.json()) as {
        message?: string | string[];
        code?: string;
      };
      message = Array.isArray(body.message)
        ? body.message[0]!
        : (body.message ?? message);
      code = typeof body.code === "string" ? body.code : undefined;
    } catch {
      // keep the generic message
    }
    throw new AssistantStreamError(message, response.status, code);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: DoneEvent | null = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseEvents(finished ? `${buffer}\n\n` : buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) {
      if (event.type === "error") {
        throw new AssistantStreamError(event.error, event.status, event.code);
      }
      onEvent(event);
      if (event.type === "done") done = event;
    }
    if (finished) break;
  }
  if (!done) throw new AssistantStreamError("The reply ended unexpectedly");
  return done;
}
