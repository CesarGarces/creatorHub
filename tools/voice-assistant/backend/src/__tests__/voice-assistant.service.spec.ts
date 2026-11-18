import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  ttsVoiceFor,
  type AIStreamChunk,
  type TTSSynthesizeParams,
  type VoiceAssistantEvent,
} from "@creator-hub/shared-types";

vi.mock("@creator-hub/database", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: (await import("./helpers/prisma-mock")).prismaMock,
}));

import { prismaMock, resetPrismaMock } from "./helpers/prisma-mock";
import {
  VoiceAssistantService,
  type ReplyInput,
} from "../voice-assistant.service";

const MODEL = {
  modelId: "deepseek-ai/DeepSeek-V4-Flash",
  displayName: "DeepSeek V4 Flash",
  tier: "FREE" as const,
};

type Chunks = Array<AIStreamChunk | Error>;

function streamOf(chunks: Chunks, onYield?: (i: number) => void) {
  return async function* (): AsyncGenerator<AIStreamChunk> {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      if (chunk instanceof Error) throw chunk;
      onYield?.(i);
      yield chunk;
    }
  };
}

const text = (...parts: string[]): Chunks => [
  ...parts.map((content) => ({ type: "content" as const, content })),
  { type: "done" as const },
];

interface SetupOptions {
  chunks?: Chunks;
  streaming?: boolean;
  ttsAvailable?: boolean;
  synthesize?: (params: TTSSynthesizeParams) => Promise<unknown>;
  onYield?: (i: number) => void;
}

function setup(options: SetupOptions = {}) {
  const chunks = options.chunks ?? text("Hola! ", "¿En qué te ayudo hoy?");
  const provider = {
    generateStream:
      options.streaming === false
        ? undefined
        : vi.fn(streamOf(chunks, options.onYield)),
    generate: vi.fn(async () => ({
      output: {
        type: "text",
        content: chunks
          .map((c) => (c instanceof Error ? "" : (c.content ?? "")))
          .join(""),
      },
    })),
  };
  const providers = {
    getStreamingProviderForModel: vi.fn(async () =>
      options.streaming === false ? undefined : provider,
    ),
    getProviderForModel: vi.fn(async () => provider),
  };
  const credits = {
    hasEnoughCredits: vi.fn(async () => true),
    deduct: vi.fn(async () => true),
    getBalance: vi.fn(async () => 41),
  };
  const usage = { logUsage: vi.fn(async () => undefined) };
  const tts = {
    isAvailable: vi.fn(() => options.ttsAvailable ?? true),
    voiceFor: vi.fn((language: string) => ttsVoiceFor(language)),
    synthesize: vi.fn(
      options.synthesize ??
        (async ({ text: said, language }: TTSSynthesizeParams) => ({
          audio: Buffer.from(said),
          mimeType: "audio/mpeg",
          durationMs: said.length * 50,
          voice: ttsVoiceFor(language).model,
          provider: "deepgram",
        })),
    ),
  };
  const tools = {
    getActive: vi.fn(() => [
      { id: "script-writer", name: "Script Writer", description: "Scripts" },
      { id: "voice-assistant", name: "Robotina", description: "Me" },
    ]),
  };
  const service = new VoiceAssistantService(
    providers as never,
    credits as never,
    usage as never,
    tts as never,
    tools as never,
  );

  prismaMock.modelMetadata.findFirst.mockResolvedValue(MODEL);
  prismaMock.user.findUnique.mockResolvedValue({
    plan: "FREE",
    name: "Ana María",
  });
  prismaMock.voiceConversation.create.mockImplementation(async ({ data }) => ({
    id: "conv1",
    language: "en",
    ...data,
  }));
  prismaMock.voiceConversation.update.mockResolvedValue({});
  prismaMock.voiceConversation.delete.mockResolvedValue({});
  let messageId = 0;
  prismaMock.voiceMessage.create.mockImplementation(async ({ data }) => ({
    id: `m${++messageId}`,
    ...data,
  }));
  prismaMock.voiceMessage.update.mockResolvedValue({});
  prismaMock.voiceMessage.delete.mockResolvedValue({});
  prismaMock.voiceMessage.findMany.mockResolvedValue([]);

  return { service, provider, providers, credits, usage, tts, tools };
}

function input(overrides: Partial<ReplyInput> = {}) {
  const events: VoiceAssistantEvent[] = [];
  return {
    events,
    input: {
      userId: "u1",
      content: "Hola Robotina, ¿cómo estás?",
      spoken: true,
      modelId: MODEL.modelId,
      onEvent: (event: VoiceAssistantEvent) => events.push(event),
      ...overrides,
    } satisfies ReplyInput,
  };
}

const ofType = <T extends VoiceAssistantEvent["type"]>(
  events: VoiceAssistantEvent[],
  type: T,
) =>
  events.filter(
    (e): e is Extract<VoiceAssistantEvent, { type: T }> => e.type === type,
  );

function assistantRow() {
  const call = prismaMock.voiceMessage.create.mock.calls.find(
    ([arg]) => arg.data.role === "assistant",
  );
  return call?.[0].data;
}

beforeEach(() => {
  resetPrismaMock();
});

describe("VoiceAssistantService.reply — spoken", () => {
  it("answers in the user's language with the matching Aura-2 voice", async () => {
    const { service, tts, provider } = setup();
    const { input: req, events } = input();

    await service.reply(req);

    expect(events.map((e) => e.type)).toEqual([
      "start",
      "delta",
      "delta",
      "audio",
      "done",
    ]);
    expect(events[0]).toEqual({
      type: "start",
      conversationId: "conv1",
      userMessageId: "m1",
      language: "es",
      voice: { model: "aura-2-celeste-es", name: "Celeste" },
      title: "Hola Robotina, ¿cómo estás?",
    });
    expect(tts.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hola! ¿En qué te ayudo hoy?",
        language: "es",
      }),
    );
    const [audio] = ofType(events, "audio");
    expect(audio).toMatchObject({
      index: 0,
      mimeType: "audio/mpeg",
      text: "Hola! ¿En qué te ayudo hoy?",
      data: Buffer.from("Hola! ¿En qué te ayudo hoy?").toString("base64"),
    });

    const request = provider.generateStream!.mock.calls[0]![0] as {
      prompt: string;
      parameters: Record<string, unknown>;
    };
    expect(request.prompt).toBe("Hola Robotina, ¿cómo estás?");
    expect(request.parameters.systemPrompt).toContain("Reply ONLY in Spanish");
    expect(request.parameters.systemPrompt).toContain("VOICE MODE");
    expect(request.parameters.systemPrompt).toContain(
      "You are talking with Ana.",
    );
    expect(request.parameters.systemPrompt).toContain("- Script Writer");
    expect(request.parameters.systemPrompt).not.toContain("- Robotina: Me");
    expect(request.parameters).toMatchObject({
      conversationHistory: [],
      temperature: 0.7,
      maxTokens: 300,
    });
  });

  it("saves both messages and charges 1 credit for up to a minute of speech", async () => {
    const { service, credits } = setup();
    const { input: req, events } = input();

    await service.reply(req);

    expect(prismaMock.voiceMessage.create.mock.calls[0]![0].data).toEqual({
      conversationId: "conv1",
      role: "user",
      content: "Hola Robotina, ¿cómo estás?",
      language: "es",
      spoken: true,
    });
    expect(assistantRow()).toMatchObject({
      role: "assistant",
      content: "Hola! ¿En qué te ayudo hoy?",
      language: "es",
      spoken: true,
      voice: "aura-2-celeste-es",
      audioMs: 27 * 50,
      creditsCharged: 1,
      interrupted: false,
      modelId: MODEL.modelId,
    });
    expect(prismaMock.voiceConversation.update).toHaveBeenCalledWith({
      where: { id: "conv1" },
      data: { language: "es", modelId: MODEL.modelId },
    });
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      1,
      "voice-assistant",
      "Robotina: Hola! ¿En qué te ayudo hoy?",
    );
    expect(ofType(events, "done")[0]).toEqual({
      type: "done",
      messageId: "m2",
      content: "Hola! ¿En qué te ayudo hoy?",
      language: "es",
      audioMs: 1350,
      credits: 1,
      balance: 41,
    });
  });

  it("charges 1 credit per started minute of speech", async () => {
    const { service, credits } = setup({
      synthesize: async ({ text: said }) => ({
        audio: Buffer.from(said),
        mimeType: "audio/mpeg",
        durationMs: 95_000,
        voice: "aura-2-andromeda-en",
        provider: "deepgram",
      }),
      chunks: text("Hello there, how are you doing today?"),
    });
    const { input: req } = input({ content: "Hello, how are you?" });

    await service.reply(req);

    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      2,
      "voice-assistant",
      expect.any(String),
    );
    expect(assistantRow()).toMatchObject({
      voice: "aura-2-andromeda-en",
      creditsCharged: 2,
    });
  });

  it("speaks while the model is still writing, segments in order", async () => {
    const pending: Array<() => void> = [];
    const synthCallsAtChunk: number[] = [];
    const { service } = setup({
      chunks: text(
        "First sentence here. ",
        "Second one is a bit longer than the first, with more to say about it. ",
        "Third sentence closes this answer with enough words to be a chunk.",
      ),
      // Deferred synthesis: resolved below in reverse order.
      synthesize: ({ text: said }) =>
        new Promise((resolve) => {
          pending.push(() =>
            resolve({
              audio: Buffer.from(said),
              mimeType: "audio/mpeg",
              durationMs: 1000,
              voice: "aura-2-andromeda-en",
              provider: "deepgram",
            }),
          );
        }),
      onYield: () => synthCallsAtChunk.push(pending.length),
    });
    const { input: req, events } = input({ content: "Tell me a story" });

    const running = service.reply(req);
    await vi.waitFor(() => expect(pending.length).toBe(2));
    // The first sentence went to Aura-2 before the model wrote the rest.
    expect(synthCallsAtChunk).toEqual([0, 1, 1, 1]); // 3 texts + "done"
    // The later segment finishes first: the order must still be kept.
    pending[1]!();
    pending[0]!();
    await running;

    const audio = ofType(events, "audio");
    expect(audio.map((a) => [a.index, a.text])).toEqual([
      [0, "First sentence here."],
      [
        1,
        "Second one is a bit longer than the first, with more to say about it. " +
          "Third sentence closes this answer with enough words to be a chunk.",
      ],
    ]);
    expect(events.at(-1)).toMatchObject({ type: "done", audioMs: 2000 });
  });
});

describe("VoiceAssistantService.reply — written and fallbacks", () => {
  it("answers typed messages in text only, for 1 credit", async () => {
    const { service, tts, provider, credits } = setup({
      chunks: text("Sure! Here's **one** idea."),
    });
    const { input: req, events } = input({
      content: "Give me a video idea",
      spoken: false,
    });

    await service.reply(req);

    expect(tts.synthesize).not.toHaveBeenCalled();
    expect(ofType(events, "start")[0]!.voice).toBeNull();
    expect(ofType(events, "audio")).toEqual([]);
    const request = provider.generateStream!.mock.calls[0]![0] as {
      parameters: { systemPrompt: string };
    };
    expect(request.parameters.systemPrompt).toContain("TEXT MODE");
    expect(assistantRow()).toMatchObject({
      spoken: false,
      voice: null,
      audioMs: 0,
      creditsCharged: 1,
    });
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      1,
      "voice-assistant",
      expect.any(String),
    );
  });

  it("replies in text when no voice is configured", async () => {
    const { service, tts } = setup({ ttsAvailable: false });
    const { input: req, events } = input();

    await service.reply(req);

    expect(ofType(events, "start")[0]!.voice).toBeNull();
    expect(tts.synthesize).not.toHaveBeenCalled();
    expect(assistantRow()).toMatchObject({ spoken: false, creditsCharged: 1 });
  });

  it("keeps writing when the voice fails, and bills a written reply", async () => {
    const { service } = setup({
      synthesize: async () => {
        throw new Error("Deepgram TTS error 503");
      },
    });
    const { input: req, events } = input();

    await service.reply(req);

    expect(ofType(events, "audio_error")).toHaveLength(1);
    expect(ofType(events, "audio")).toEqual([]);
    expect(ofType(events, "done")[0]).toMatchObject({
      audioMs: 0,
      credits: 1,
      content: "Hola! ¿En qué te ayudo hoy?",
    });
    expect(assistantRow()).toMatchObject({ spoken: false, voice: null });
  });

  it("uses generate() for models without streaming", async () => {
    const { service, provider } = setup({ streaming: false });
    const { input: req, events } = input();

    await service.reply(req);

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(ofType(events, "delta")).toEqual([
      { type: "delta", content: "Hola! ¿En qué te ayudo hoy?" },
    ]);
    expect(ofType(events, "audio")).toHaveLength(1);
  });

  it("keeps a partial reply when the model breaks mid-way", async () => {
    const { service, credits } = setup({
      chunks: [
        { type: "content", content: "Half an answer." },
        new Error("socket hang up"),
      ],
    });
    const { input: req, events } = input({ content: "Hello there" });

    await service.reply(req);

    expect(ofType(events, "done")[0]!.content).toBe("Half an answer.");
    expect(credits.deduct).toHaveBeenCalled();
  });
});

describe("VoiceAssistantService.reply — conversations", () => {
  it("continues a conversation with its history, oldest first", async () => {
    const { service, provider } = setup({ chunks: text("Claro.") });
    prismaMock.voiceConversation.findFirst.mockResolvedValue({
      id: "conv9",
      title: "Old",
      language: "pt",
    });
    // Newest first, read before the new message is saved.
    prismaMock.voiceMessage.findMany.mockResolvedValue([
      { role: "assistant", content: "Tudo bem!" },
      { role: "user", content: "Oi, tudo bem?" },
    ]);
    const { input: req, events } = input({
      conversationId: "conv9",
      content: "ok",
    });

    await service.reply(req);

    expect(prismaMock.voiceConversation.findFirst).toHaveBeenCalledWith({
      where: { id: "conv9", userId: "u1" },
    });
    expect(prismaMock.voiceConversation.create).not.toHaveBeenCalled();
    // Unclear message → the conversation's language (Portuguese, Bianca).
    expect(ofType(events, "start")[0]).toMatchObject({
      conversationId: "conv9",
      language: "pt",
      voice: { model: "aura-2-bianca-pt", name: "Bianca" },
    });
    const request = provider.generateStream!.mock.calls[0]![0] as {
      parameters: { conversationHistory: unknown };
    };
    expect(request.parameters.conversationHistory).toEqual([
      { role: "user", content: "Oi, tudo bem?" },
      { role: "assistant", content: "Tudo bem!" },
    ]);
    expect(prismaMock.voiceMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: "conv9" },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    );
  });

  it("switches language (and voice) when the user does", async () => {
    const { service } = setup({ chunks: text("Of course.") });
    prismaMock.voiceConversation.findFirst.mockResolvedValue({
      id: "conv9",
      title: "Old",
      language: "es",
    });
    const { input: req, events } = input({
      conversationId: "conv9",
      content: "Can you answer in English, please?",
    });

    await service.reply(req);

    expect(ofType(events, "start")[0]!.voice).toEqual({
      model: "aura-2-andromeda-en",
      name: "Andromeda",
    });
  });

  it("uses the interface language when a new message is unclear", async () => {
    const { service } = setup({ chunks: text("Oi!") });
    const { input: req, events } = input({
      content: "ok",
      languageHint: "pt",
    });
    await service.reply(req);
    expect(ofType(events, "start")[0]!.language).toBe("pt");
  });

  it("refuses other users' conversations", async () => {
    const { service } = setup();
    prismaMock.voiceConversation.findFirst.mockResolvedValue(null);
    const { input: req } = input({ conversationId: "theirs" });

    await expect(service.reply(req)).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.voiceMessage.create).not.toHaveBeenCalled();
  });

  it("shortens long first messages into the title", async () => {
    const { service } = setup();
    const { input: req } = input({ content: `${"palabra ".repeat(20)}fin` });
    await service.reply(req);
    const title =
      prismaMock.voiceConversation.create.mock.calls[0]![0].data.title;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("VoiceAssistantService.reply — refusals and failures", () => {
  it("needs at least 1 credit, before anything is saved", async () => {
    const { service, credits } = setup();
    credits.hasEnoughCredits.mockResolvedValue(false);
    const { input: req } = input();

    await expect(service.reply(req)).rejects.toThrow(/^Insufficient credits/);
    expect(credits.hasEnoughCredits).toHaveBeenCalledWith("u1", 1);
    expect(prismaMock.voiceConversation.create).not.toHaveBeenCalled();
  });

  it("refuses inactive or unknown models", async () => {
    const { service } = setup();
    prismaMock.modelMetadata.findFirst.mockResolvedValue(null);
    const { input: req } = input();
    await expect(service.reply(req)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.modelMetadata.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          modelId: MODEL.modelId,
          isActive: true,
          taskType: "text-generation",
        },
      }),
    );
  });

  it("keeps PRO models for paid plans", async () => {
    const { service } = setup();
    prismaMock.modelMetadata.findFirst.mockResolvedValue({
      ...MODEL,
      tier: "PRO",
    });
    const { input: req } = input();
    await expect(service.reply(req)).rejects.toBeInstanceOf(ForbiddenException);

    prismaMock.user.findUnique.mockResolvedValue({ plan: "STARTER" });
    const ok = input();
    await service.reply(ok.input);
    expect(ok.events.at(-1)!.type).toBe("done");
  });

  it("charges nothing and undoes a new conversation when the model fails", async () => {
    const { service, credits, usage } = setup({
      chunks: [new Error("upstream 500")],
    });
    const { input: req } = input();

    await expect(service.reply(req)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(credits.deduct).not.toHaveBeenCalled();
    expect(prismaMock.voiceConversation.delete).toHaveBeenCalledWith({
      where: { id: "conv1" },
    });
    expect(usage.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, credits: 0 }),
    );
  });

  it("removes only the new message from an existing conversation on failure", async () => {
    const { service } = setup({ chunks: text("") });
    prismaMock.voiceConversation.findFirst.mockResolvedValue({
      id: "conv9",
      title: "Old",
      language: "en",
    });
    const { input: req } = input({ conversationId: "conv9" });

    await expect(service.reply(req)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(prismaMock.voiceMessage.delete).toHaveBeenCalledWith({
      where: { id: "m1" },
    });
    expect(prismaMock.voiceConversation.delete).not.toHaveBeenCalled();
  });

  it("takes what is left when the balance no longer covers the reply", async () => {
    const { service, credits } = setup({
      synthesize: async () => ({
        audio: Buffer.from("x"),
        mimeType: "audio/mpeg",
        durationMs: 130_000,
        voice: "aura-2-celeste-es",
        provider: "deepgram",
      }),
    });
    credits.deduct.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    credits.getBalance.mockResolvedValueOnce(2).mockResolvedValue(0);
    const { input: req, events } = input();

    await service.reply(req);

    expect(credits.deduct.mock.calls.map((c) => c[1])).toEqual([3, 2]);
    expect(prismaMock.voiceMessage.update).toHaveBeenCalledWith({
      where: { id: "m2" },
      data: { creditsCharged: 2 },
    });
    expect(ofType(events, "done")[0]).toMatchObject({ credits: 2, balance: 0 });
  });
});

describe("VoiceAssistantService.reply — interruptions", () => {
  it("stops at once when interrupted, keeps and bills what was produced", async () => {
    const abort = new AbortController();
    const { service, credits } = setup({
      chunks: text(
        "First part of the answer. ",
        "Second part that nobody hears. ",
        "Third.",
      ),
      onYield: (i) => {
        if (i === 1) abort.abort();
      },
    });
    const { input: req, events } = input({
      content: "Tell me something",
      signal: abort.signal,
    });

    await service.reply(req);

    // Nothing is sent after the interruption (the client is gone).
    expect(events.some((e) => e.type === "done")).toBe(false);
    expect(assistantRow()).toMatchObject({
      content: "First part of the answer.",
      interrupted: true,
      // Its audio was never delivered: billed as a written reply.
      audioMs: 0,
      creditsCharged: 1,
    });
    expect(credits.deduct).toHaveBeenCalledTimes(1);
  });

  it("charges nothing when interrupted before the first word", async () => {
    const abort = new AbortController();
    abort.abort();
    const { service, credits } = setup();
    const { input: req, events } = input({ signal: abort.signal });

    await service.reply(req);

    expect(events).toEqual([]);
    expect(assistantRow()).toBeUndefined();
    expect(credits.deduct).not.toHaveBeenCalled();
  });
});

describe("VoiceAssistantService — history", () => {
  it("lists the user's conversations, newest first", async () => {
    const { service } = setup();
    const at = new Date("2026-11-27T10:00:00Z");
    prismaMock.voiceConversation.findMany.mockResolvedValue([
      {
        id: "c1",
        title: "Hola",
        language: "es",
        createdAt: at,
        updatedAt: at,
        messages: [{ content: "¡Hasta luego!" }],
        _count: { messages: 4 },
      },
    ]);
    prismaMock.voiceConversation.count.mockResolvedValue(21);

    const result = await service.listConversations("u1", 2, 10);

    expect(prismaMock.voiceConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        orderBy: { updatedAt: "desc" },
        skip: 10,
        take: 10,
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: "c1",
          title: "Hola",
          language: "es",
          lastMessage: "¡Hasta luego!",
          messageCount: 4,
          createdAt: at.toISOString(),
          updatedAt: at.toISOString(),
        },
      ],
      meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });

  it("returns one conversation with its messages", async () => {
    const { service } = setup();
    const at = new Date("2026-11-27T10:00:00Z");
    prismaMock.voiceConversation.findFirst.mockResolvedValue({
      id: "c1",
      title: "Hi",
      language: "en",
      createdAt: at,
      updatedAt: at,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Hi",
          language: "en",
          spoken: true,
          voice: null,
          audioMs: 0,
          creditsCharged: 0,
          interrupted: false,
          createdAt: at,
        },
      ],
    });

    const detail = await service.getConversation("u1", "c1");
    expect(detail.messages[0]).toMatchObject({ id: "m1", spoken: true });
    expect(detail.lastMessage).toBe("Hi");
    expect(prismaMock.voiceConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1", userId: "u1" } }),
    );
  });

  it("404s on conversations of other users", async () => {
    const { service } = setup();
    prismaMock.voiceConversation.findFirst.mockResolvedValue(null);
    prismaMock.voiceConversation.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.getConversation("u1", "x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.deleteConversation("u1", "x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("deletes a conversation of the user", async () => {
    const { service } = setup();
    prismaMock.voiceConversation.deleteMany.mockResolvedValue({ count: 1 });
    await service.deleteConversation("u1", "c1");
    expect(prismaMock.voiceConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: "c1", userId: "u1" },
    });
  });
});
