import { EventEmitter } from "events";
import { Readable } from "stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { toolManifest } from "../../../__tests__/helpers/tool-manifest";
import { ChatService } from "../chat.service";
import { ChatController } from "../chat.controller";

type SseEvent = { type: string; [key: string]: unknown };

/** Reads a chat SSE stream to the end and parses its `data:` events. */
async function readEvents(stream: Readable): Promise<SseEvent[]> {
  let raw = "";
  for await (const chunk of stream) raw += chunk.toString();
  return raw
    .split("\n\n")
    .filter(Boolean)
    .map((block) => JSON.parse(block.replace(/^data: /, "")) as SseEvent);
}

async function* fakeAiStream(
  chunks: Array<{ type: string; content?: string }>,
) {
  for (const chunk of chunks) yield chunk;
}

describe("ChatService", () => {
  const providerRegistry = {
    getStreamingProviderForModel: vi.fn(),
    getProviderForModel: vi.fn(),
    getAnyProviderForTask: vi.fn(),
  };
  const routingService = {
    buildSystemPrompt: vi.fn(),
    getActiveTools: vi.fn(),
  };
  const historyService = {
    appendMessage: vi.fn(),
    updateSessionActivity: vi.fn(),
    getSessionMessageHistory: vi.fn(),
  };
  const settingsService = { getSettings: vi.fn() };
  const creditService = { hasEnoughCredits: vi.fn(), deduct: vi.fn() };
  const usageLogger = { logUsage: vi.fn() };
  let service: ChatService;

  const session = {
    id: "s1",
    userId: "u1",
    model: "deepseek-ai/DeepSeek-V4-Flash",
    temperature: 0.5,
    maxTokens: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    service = new ChatService(
      providerRegistry as never,
      routingService as never,
      historyService as never,
      settingsService as never,
      creditService as never,
      usageLogger as never,
    );

    prismaMock.chatSession.findUnique.mockResolvedValue(session);
    prismaMock.provider.findFirst.mockResolvedValue({ costPerCredit: 3 });
    creditService.hasEnoughCredits.mockResolvedValue(true);
    creditService.deduct.mockResolvedValue(true);
    historyService.getSessionMessageHistory.mockResolvedValue([
      { role: "user", content: "earlier question" },
      { role: "assistant", content: "earlier answer" },
      { role: "user", content: "Hello?" },
    ]);
    routingService.buildSystemPrompt.mockResolvedValue("SYSTEM");
    providerRegistry.getProviderForModel.mockResolvedValue(null);
  });

  describe("createSession", () => {
    it("falls back to the user's settings for unset options", async () => {
      settingsService.getSettings.mockResolvedValue({
        defaultModel: "default-model",
        temperature: 0.7,
        maxTokens: 8000,
        reasoning: 0.7,
      });

      await service.createSession("u1", { title: "Ideas", temperature: 0 });

      expect(prismaMock.chatSession.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          title: "Ideas",
          model: "default-model",
          temperature: 0,
          maxTokens: 8000,
          reasoning: 0.7,
        },
      });
    });
  });

  describe("createMessageStream", () => {
    it("streams content, saves both messages and charges the model's cost", async () => {
      const generateStream = vi.fn(() =>
        fakeAiStream([
          { type: "content", content: "Hel" },
          { type: "content", content: "lo!" },
          { type: "done" },
          { type: "content", content: "IGNORED AFTER DONE" },
        ]),
      );
      providerRegistry.getStreamingProviderForModel.mockResolvedValue({
        generateStream,
      });

      const events = await readEvents(
        service.createMessageStream("s1", "u1", { content: "Hello?" }),
      );

      expect(events).toEqual([
        { type: "start", model: session.model, creditCost: 3 },
        { type: "content", content: "Hel" },
        { type: "content", content: "lo!" },
        { type: "done", content: "Hello!", creditCost: 3 },
      ]);

      expect(generateStream).toHaveBeenCalledWith({
        taskType: "text-generation",
        prompt: "Hello?",
        parameters: {
          temperature: 0.5,
          maxTokens: 1000,
          systemPrompt: "SYSTEM",
          // The just-saved user message is sent as the prompt, not history.
          conversationHistory: [
            { role: "user", content: "earlier question" },
            { role: "assistant", content: "earlier answer" },
          ],
        },
      });
      expect(historyService.appendMessage).toHaveBeenNthCalledWith(
        1,
        "s1",
        "user",
        "Hello?",
      );
      expect(historyService.appendMessage).toHaveBeenNthCalledWith(
        2,
        "s1",
        "assistant",
        "Hello!",
      );
      expect(creditService.deduct).toHaveBeenCalledWith(
        "u1",
        3,
        "chat",
        `Chat message (${session.model})`,
      );
      await vi.waitFor(() =>
        expect(usageLogger.logUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "u1",
            toolId: "chat",
            success: true,
            credits: 3,
          }),
        ),
      );
    });

    it("charges 1 credit when the model has no active provider record", async () => {
      prismaMock.provider.findFirst.mockResolvedValue(null);
      providerRegistry.getStreamingProviderForModel.mockResolvedValue({
        generateStream: () => fakeAiStream([{ type: "done" }]),
      });

      const events = await readEvents(
        service.createMessageStream("s1", "u1", { content: "Hello?" }),
      );

      expect(events[0]).toMatchObject({ type: "start", creditCost: 1 });
      expect(creditService.hasEnoughCredits).toHaveBeenCalledWith("u1", 1);
    });

    it("falls back to a non-streaming provider", async () => {
      providerRegistry.getStreamingProviderForModel.mockResolvedValue(null);
      providerRegistry.getAnyProviderForTask.mockReturnValue({
        generate: vi.fn().mockResolvedValue({
          output: { type: "text", content: "Full answer" },
        }),
      });

      const events = await readEvents(
        service.createMessageStream("s1", "u1", { content: "Hello?" }),
      );

      expect(providerRegistry.getAnyProviderForTask).toHaveBeenCalledWith(
        "text-generation",
      );
      expect(events.map((e) => e.type)).toEqual(["start", "content", "done"]);
      expect(events[1]).toEqual({ type: "content", content: "Full answer" });
      expect(historyService.appendMessage).toHaveBeenLastCalledWith(
        "s1",
        "assistant",
        "Full answer",
      );
    });

    it("stops before calling the AI when the user lacks credits", async () => {
      creditService.hasEnoughCredits.mockResolvedValue(false);

      const events = await readEvents(
        service.createMessageStream("s1", "u1", { content: "Hello?" }),
      );

      expect(events).toEqual([
        {
          type: "error",
          error: "Insufficient credits. This model requires 3 credits.",
        },
      ]);
      expect(historyService.appendMessage).not.toHaveBeenCalled();
      expect(
        providerRegistry.getStreamingProviderForModel,
      ).not.toHaveBeenCalled();
      expect(creditService.deduct).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(usageLogger.logUsage).toHaveBeenCalledWith(
          expect.objectContaining({ success: false, credits: 0 }),
        ),
      );
    });

    it("reports an unknown session as an error event", async () => {
      prismaMock.chatSession.findUnique.mockResolvedValue(null);

      const events = await readEvents(
        service.createMessageStream("nope", "u1", { content: "Hi" }),
      );

      expect(events).toEqual([
        { type: "error", error: "Session not found: nope" },
      ]);
      expect(creditService.hasEnoughCredits).not.toHaveBeenCalled();
    });

    it("does not charge when no provider can serve the model", async () => {
      providerRegistry.getStreamingProviderForModel.mockResolvedValue(null);
      providerRegistry.getAnyProviderForTask.mockReturnValue(undefined);

      const events = await readEvents(
        service.createMessageStream("s1", "u1", { content: "Hello?" }),
      );

      expect(events.at(-1)).toEqual({
        type: "error",
        error: `No provider available for model: ${session.model}`,
      });
      expect(creditService.deduct).not.toHaveBeenCalled();
    });

    it("does not charge when the AI stream fails midway", async () => {
      providerRegistry.getStreamingProviderForModel.mockResolvedValue({
        generateStream: async function* () {
          yield { type: "content", content: "partial" };
          throw new Error("upstream reset");
        },
      });

      const events = await readEvents(
        service.createMessageStream("s1", "u1", { content: "Hello?" }),
      );

      expect(events.at(-1)).toEqual({ type: "error", error: "upstream reset" });
      expect(creditService.deduct).not.toHaveBeenCalled();
    });
  });

  describe("getAvailableTools", () => {
    it("exposes tool summaries with their first route", () => {
      routingService.getActiveTools.mockReturnValue([
        toolManifest({ id: "thumb", name: "Thumbs" }),
      ]);

      expect(service.getAvailableTools()).toEqual([
        {
          id: "thumb",
          name: "Thumbs",
          description: "Creates video thumbnails",
          category: "thumbnail",
          creditsPerUse: 10,
          route: "/tools/thumb",
        },
      ]);
    });
  });
});

describe("ChatController", () => {
  const chatService = {
    createSession: vi.fn(),
    createMessageStream: vi.fn(),
    getAvailableTools: vi.fn(),
  };
  const historyService = {
    listSessions: vi.fn(),
    getSession: vi.fn(),
    deleteSession: vi.fn(),
  };
  const settingsService = { getSettings: vi.fn(), updateSettings: vi.fn() };
  const routingService = { getChatSuggestions: vi.fn() };
  const controller = new ChatController(
    chatService as never,
    historyService as never,
    settingsService as never,
    routingService as never,
  );

  function fakeResponse() {
    return Object.assign(new EventEmitter(), {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    });
  }

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ChatController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it("pipes the message stream to the client as server-sent events", async () => {
    const stream = new Readable({ read() {} });
    chatService.createMessageStream.mockReturnValue(stream);
    const res = fakeResponse();

    await controller.sendMessage("s1", "u1", { content: "Hi" }, res as never);
    stream.push('data: {"type":"start"}\n\n');
    stream.push(null);
    await new Promise((resolve) => stream.on("end", resolve));

    expect(chatService.createMessageStream).toHaveBeenCalledWith("s1", "u1", {
      content: "Hi",
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream",
    );
    expect(res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(
      Buffer.from('data: {"type":"start"}\n\n'),
    );
    expect(res.end).toHaveBeenCalled();
  });

  it("sends an error event when the stream fails", async () => {
    const stream = new Readable({ read() {} });
    chatService.createMessageStream.mockReturnValue(stream);
    const res = fakeResponse();

    await controller.sendMessage("s1", "u1", { content: "Hi" }, res as never);
    stream.destroy(new Error("boom"));
    await new Promise((resolve) => stream.on("close", resolve));

    expect(res.write).toHaveBeenCalledWith(
      'data: {"type":"error","error":"boom"}\n\n',
    );
    expect(res.end).toHaveBeenCalled();
  });

  it("stops generating when the client disconnects", async () => {
    const stream = new Readable({ read() {} });
    const destroy = vi.spyOn(stream, "destroy");
    chatService.createMessageStream.mockReturnValue(stream);
    const res = fakeResponse();

    await controller.sendMessage("s1", "u1", { content: "Hi" }, res as never);
    res.emit("close");

    expect(destroy).toHaveBeenCalled();
  });

  it("delegates session and settings endpoints", async () => {
    await controller.createSession("u1", { title: "t" });
    await controller.listSessions("u1");
    await controller.updateSettings("u1", { temperature: 0.3 });
    expect(await controller.deleteSession("s1")).toEqual({ success: true });

    expect(chatService.createSession).toHaveBeenCalledWith("u1", {
      title: "t",
    });
    expect(historyService.listSessions).toHaveBeenCalledWith("u1");
    expect(settingsService.updateSettings).toHaveBeenCalledWith("u1", {
      temperature: 0.3,
    });
    expect(historyService.deleteSession).toHaveBeenCalledWith("s1");
  });
});
