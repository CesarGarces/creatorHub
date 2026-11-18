import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";
import { VoiceAssistantController } from "../voice-assistant.controller";
import type { ReplyInput } from "../voice-assistant.service";

function fakeResponse() {
  const chunks: string[] = [];
  let onClose: (() => void) | undefined;
  const res = {
    headers: {} as Record<string, string>,
    writableEnded: false,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    flushHeaders: vi.fn(),
    write: (chunk: string) => chunks.push(chunk),
    end() {
      this.writableEnded = true;
    },
    on: (_event: "close", listener: () => void) => (onClose = listener),
  };
  const events = () =>
    chunks.map((c) => JSON.parse(c.replace(/^data: /, "").trim()));
  return { res, events, close: () => onClose?.() };
}

const DTO = {
  content: "Hola",
  spoken: true,
  model: "m1",
  temperature: 0.5,
  maxTokens: 200,
  languageHint: "es" as const,
  conversationId: "c1",
};

describe("VoiceAssistantController", () => {
  it("is mounted at /tools/voice-assistant behind the JWT guard", () => {
    expect(Reflect.getMetadata(PATH_METADATA, VoiceAssistantController)).toBe(
      "tools/voice-assistant",
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, VoiceAssistantController),
    ).toEqual([JwtAuthGuard]);
  });

  it("streams the reply as SSE and passes the request through", async () => {
    const assistant = {
      reply: vi.fn(async (input: ReplyInput) => {
        input.onEvent({ type: "delta", content: "¡Hola!" });
        input.onEvent({
          type: "done",
          messageId: "m2",
          content: "¡Hola!",
          language: "es",
          audioMs: 900,
          credits: 1,
          balance: 9,
        });
      }),
    };
    const controller = new VoiceAssistantController(assistant as never);
    const { res, events } = fakeResponse();

    await controller.send("u1", DTO, res);

    expect(res.headers["Content-Type"]).toBe("text/event-stream");
    expect(res.headers["X-Accel-Buffering"]).toBe("no");
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(events().map((e) => e.type)).toEqual(["delta", "done"]);
    expect(assistant.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        conversationId: "c1",
        content: "Hola",
        spoken: true,
        modelId: "m1",
        temperature: 0.5,
        maxTokens: 200,
        languageHint: "es",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(res.writableEnded).toBe(true);
  });

  it("aborts the reply when the client closes the stream", async () => {
    let signal: AbortSignal | undefined;
    const { res, close } = fakeResponse();
    const assistant = {
      reply: vi.fn(async (input: ReplyInput) => {
        signal = input.signal;
        close(); // barge-in / tab closed
      }),
    };
    await new VoiceAssistantController(assistant as never).send("u1", DTO, res);
    expect(signal?.aborted).toBe(true);
  });

  it("sends 4xx messages as they are", async () => {
    const assistant = {
      reply: vi.fn(async () => {
        throw new BadRequestException("Insufficient credits. Talking…");
      }),
    };
    const { res, events } = fakeResponse();
    await new VoiceAssistantController(assistant as never).send("u1", DTO, res);
    expect(events()).toEqual([
      { type: "error", status: 400, error: "Insufficient credits. Talking…" },
    ]);
    expect(res.writableEnded).toBe(true);
  });

  it("keeps the model-failure message and hides other server errors", async () => {
    const failing = (error: Error) => ({
      reply: vi.fn(async () => {
        throw error;
      }),
    });

    const a = fakeResponse();
    await new VoiceAssistantController(
      failing(
        new BadGatewayException(
          "Robotina couldn't answer. Try again or choose another model.",
        ),
      ) as never,
    ).send("u1", DTO, a.res);
    expect(a.events()[0]).toMatchObject({ status: 502 });
    expect(a.events()[0].error).toMatch(/choose another model/);

    const b = fakeResponse();
    await new VoiceAssistantController(
      failing(new InternalServerErrorException("db password wrong")) as never,
    ).send("u1", DTO, b.res);
    expect(b.events()[0]).toEqual({
      type: "error",
      status: 500,
      error: "Robotina couldn't answer. Please try again.",
    });

    const c = fakeResponse();
    await new VoiceAssistantController(
      failing(new Error("boom")) as never,
    ).send("u1", DTO, c.res);
    expect(c.events()[0].status).toBe(500);
  });

  it("lists, reads and deletes conversations", async () => {
    const assistant = {
      listConversations: vi.fn(async () => ({ data: [], meta: { page: 1 } })),
      getConversation: vi.fn(async () => ({ id: "c1" })),
      deleteConversation: vi.fn(async () => undefined),
    };
    const controller = new VoiceAssistantController(assistant as never);

    expect(await controller.list("u1", {})).toEqual({
      success: true,
      data: [],
      meta: { page: 1 },
    });
    expect(assistant.listConversations).toHaveBeenCalledWith("u1", 1, 20);
    await controller.list("u1", { page: 3, limit: 5 });
    expect(assistant.listConversations).toHaveBeenLastCalledWith("u1", 3, 5);

    expect(await controller.get("u1", "c1")).toEqual({
      success: true,
      data: { id: "c1" },
    });
    expect(await controller.remove("u1", "c1")).toEqual({ success: true });
    expect(assistant.deleteConversation).toHaveBeenCalledWith("u1", "c1");
  });
});
