import { afterEach, describe, expect, it, vi } from "vitest";
import type { VoiceAssistantEvent } from "@creator-hub/shared-types";
import {
  AssistantStreamError,
  parseSseEvents,
  streamAssistantReply,
} from "../stream";

const sse = (...events: object[]) =>
  events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

/** A fetch Response whose body arrives in the given string chunks. */
function streamed(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { value: encoder.encode(chunks[i++]), done: false }
            : { value: undefined, done: true },
      }),
    },
    json: async () => ({}),
  } as unknown as Response;
}

const REQUEST = {
  content: "Hola",
  spoken: true,
  model: "m1",
};

const DONE = {
  type: "done",
  messageId: "m2",
  content: "¡Hola!",
  language: "es",
  audioMs: 900,
  credits: 1,
  balance: 9,
};

afterEach(() => vi.unstubAllGlobals());

describe("parseSseEvents", () => {
  it("parses complete events and keeps the partial rest", () => {
    const { events, rest } = parseSseEvents(
      `${sse({ type: "delta", content: "a" })}data: {"type":"del`,
    );
    expect(events).toEqual([{ type: "delta", content: "a" }]);
    expect(rest).toBe('data: {"type":"del');
  });

  it("ignores malformed events and non-data lines", () => {
    const { events } = parseSseEvents(
      `: keep-alive\n\ndata: {oops\n\n${sse({ type: "delta", content: "b" })}`,
    );
    expect(events).toEqual([{ type: "delta", content: "b" }]);
  });
});

describe("streamAssistantReply", () => {
  it("posts the message and reports every event, split across chunks", async () => {
    const body = sse(
      { type: "start", conversationId: "c1" },
      { type: "delta", content: "¡Hola!" },
      { type: "audio", index: 0, data: "AAA=", mimeType: "audio/mpeg" },
      DONE,
    );
    const fetchMock = vi.fn(async () =>
      streamed([body.slice(0, 17), body.slice(17, 60), body.slice(60)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const events: VoiceAssistantEvent[] = [];

    const done = await streamAssistantReply(REQUEST, (e) => events.push(e));

    expect(done).toEqual(DONE);
    expect(events.map((e) => e.type)).toEqual([
      "start",
      "delta",
      "audio",
      "done",
    ]);
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/tools\/voice-assistant\/messages$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(REQUEST);
  });

  it("rejects with the streamed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamed([
          sse({ type: "error", status: 400, error: "Insufficient credits." }),
        ]),
      ),
    );
    const error = await streamAssistantReply(REQUEST, () => {}).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AssistantStreamError);
    expect(error).toMatchObject({
      message: "Insufficient credits.",
      status: 400,
    });
  });

  it("rejects with the HTTP error message (validation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: false,
            status: 400,
            body: null,
            json: async () => ({ message: ["content should not be empty"] }),
          }) as unknown as Response,
      ),
    );
    await expect(streamAssistantReply(REQUEST, () => {})).rejects.toThrow(
      "content should not be empty",
    );
  });

  it("rejects when the stream ends without a reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamed([sse({ type: "delta", content: "x" })])),
    );
    await expect(streamAssistantReply(REQUEST, () => {})).rejects.toThrow(
      "The reply ended unexpectedly",
    );
  });
});
