import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  DEFAULT_VOICE_SETTINGS,
  ttsVoiceFor,
  type VoiceSettings,
  type AIStreamChunk,
  type TTSSynthesizeParams,
  type VoiceAssistantEvent,
} from "@creator-hub/shared-types";

vi.mock("@creator-hub/database", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: (await import("./helpers/prisma-mock")).prismaMock,
}));

import { AssistantActionRegistry } from "@creator-hub/tool-sdk";
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
  /** One stream per model call (rounds around actions). */
  rounds?: Chunks[];
  registry?: unknown;
  streaming?: boolean;
  ttsAvailable?: boolean;
  synthesize?: (params: TTSSynthesizeParams) => Promise<unknown>;
  onYield?: (i: number) => void;
  /** Admin → Voice settings (defaults: Aura-2 voices, 2 credits/s). */
  settings?: VoiceSettings;
  balance?: number;
  /** Free plan seconds left with Robotina (null: unlimited). */
  freeSecondsLeft?: number | null;
}

function setup(options: SetupOptions = {}) {
  let calls = 0;
  const chunks = options.chunks ?? text("Hola! ", "¿En qué te ayudo hoy?");
  const provider = {
    generateStream:
      options.streaming === false
        ? undefined
        : vi.fn((...args: unknown[]) => {
            void args;
            const rounds = options.rounds ?? [chunks];
            const round = rounds[Math.min(calls++, rounds.length - 1)]!;
            return streamOf(round, options.onYield)();
          }),
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
    getBalance: vi.fn(async () => options.balance ?? 41),
  };
  const usage = { logUsage: vi.fn(async () => undefined) };
  const tts = {
    isAvailable: vi.fn(() => options.ttsAvailable ?? true),
    voiceFor: vi.fn((language: string) => ttsVoiceFor(language)),
    synthesize: vi.fn(
      options.synthesize ??
        (async ({ text: said, language, voice }: TTSSynthesizeParams) => ({
          audio: Buffer.from(said),
          mimeType: "audio/mpeg",
          durationMs: said.length * 50,
          voice: voice ?? ttsVoiceFor(language).model,
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
  const voiceSettings = {
    get: vi.fn(async () => options.settings ?? DEFAULT_VOICE_SETTINGS),
  };
  // Free plan minutes with Robotina (default: unlimited).
  const freeLeft = options.freeSecondsLeft ?? null;
  const allowance = {
    get: vi.fn(async () => ({
      limited: freeLeft !== null,
      period: "monthly",
      limitSeconds: freeLeft === null ? null : 600,
      usedSeconds: freeLeft === null ? 0 : 600 - freeLeft,
      remainingSeconds: freeLeft,
      exhausted: freeLeft === 0,
      resetsAt: null,
    })),
    record: vi.fn(async () => undefined),
  };
  const service = new VoiceAssistantService(
    providers as never,
    credits as never,
    usage as never,
    tts as never,
    voiceSettings as never,
    allowance as never,
    tools as never,
    options.registry as never,
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

  return {
    service,
    provider,
    providers,
    credits,
    usage,
    tts,
    tools,
    voiceSettings,
    allowance,
  };
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

  it("saves both messages and charges its seconds of speech (120 cr/min)", async () => {
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
      creditsCharged: 4, // 1.35 s → 2 started seconds at 120 credits per minute
      interrupted: false,
      modelId: MODEL.modelId,
    });
    expect(prismaMock.voiceConversation.update).toHaveBeenCalledWith({
      where: { id: "conv1" },
      data: { language: "es", modelId: MODEL.modelId },
    });
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      4,
      "voice-assistant",
      "Robotina: Hola! ¿En qué te ayudo hoy?",
    );
    expect(ofType(events, "done")[0]).toEqual({
      type: "done",
      messageId: "m2",
      content: "Hola! ¿En qué te ayudo hoy?",
      language: "es",
      audioMs: 1350,
      credits: 4,
      balance: 41,
    });
  });

  it("speaks with the voice and price set in Admin → Voice", async () => {
    const { service, credits, tts } = setup({
      settings: {
        ...DEFAULT_VOICE_SETTINGS,
        tts: {
          ...DEFAULT_VOICE_SETTINGS.tts,
          creditsPerMinute: 30,
          voices: {
            ...DEFAULT_VOICE_SETTINGS.tts.voices,
            en: { model: "aura-2", voice: "aura-2-orion-en" },
          },
        },
      },
      balance: 1000,
      synthesize: async ({ text: said, voice }) => ({
        audio: Buffer.from(said),
        mimeType: "audio/mpeg",
        durationMs: 95_000,
        voice: voice!,
        provider: "deepgram",
      }),
      chunks: text("Hello there, how are you doing today?"),
    });
    const { input: req, events } = input({ content: "Hello, how are you?" });

    await service.reply(req);

    expect(tts.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en", voice: "aura-2-orion-en" }),
    );
    expect(ofType(events, "start")[0]!.voice).toEqual({
      model: "aura-2-orion-en",
      name: "Orion",
    });
    // 95 s at 30 credits per minute = 47.5 → 48.
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      48,
      "voice-assistant",
      expect.any(String),
    );
    expect(assistantRow()).toMatchObject({
      voice: "aura-2-orion-en",
      creditsCharged: 48,
    });
  });

  it("only speaks what the balance pays for, then goes on in text", async () => {
    const { service, credits } = setup({
      balance: 5, // 2 s of speech at 120 credits per minute
      chunks: text("First sentence here. ", "Second sentence there."),
      synthesize: async ({ text: said, voice }) => ({
        audio: Buffer.from(said),
        mimeType: "audio/mpeg",
        durationMs: 1_500,
        voice: voice!,
        provider: "deepgram",
      }),
    });
    const { input: req, events } = input({ content: "Tell me two things" });

    await service.reply(req);

    expect(ofType(events, "audio")).toHaveLength(1);
    expect(ofType(events, "audio_error")[0]).toMatchObject({
      reason: "credits",
    });
    expect(assistantRow()).toMatchObject({
      content: "First sentence here. Second sentence there.",
      audioMs: 1_500,
      creditsCharged: 4,
    });
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      4,
      "voice-assistant",
      expect.any(String),
    );
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
      voice: { model: "flux-bianca-pt", name: "Bianca" },
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

  it("refuses a Free user whose minutes with her are used up (upgrade)", async () => {
    const { service, provider, credits } = setup({ freeSecondsLeft: 0 });
    const { input: req } = input();
    const error = await service.reply(req).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: "FREE_LIMIT_REACHED",
    });
    expect((error as Error).message).toMatch(/free minutes/);
    expect(prismaMock.voiceMessage.create).not.toHaveBeenCalled();
    expect(provider.generateStream).not.toHaveBeenCalled();
    expect(credits.deduct).not.toHaveBeenCalled();
  });

  it("speaks only the Free minutes left, then text; her voice is counted", async () => {
    const { service, allowance } = setup({
      freeSecondsLeft: 2,
      balance: 1000,
      chunks: text("First sentence here. ", "Second sentence there."),
      synthesize: async ({ text: said, voice }) => ({
        audio: Buffer.from(said),
        mimeType: "audio/mpeg",
        durationMs: 1_500,
        voice: voice!,
        provider: "deepgram",
      }),
    });
    const { input: req, events } = input({ content: "Tell me two things" });

    await service.reply(req);

    expect(ofType(events, "audio")).toHaveLength(1);
    expect(ofType(events, "audio_error")[0]).toMatchObject({
      reason: "free-limit",
    });
    expect(allowance.record).toHaveBeenCalledWith("u1", 1_500);
  });

  it("doesn't count the time of unlimited users", async () => {
    const { service, allowance } = setup();
    const { input: req } = input();
    await service.reply(req);
    expect(allowance.record).not.toHaveBeenCalled();
  });

  it("takes what is left when the balance no longer covers the reply", async () => {
    const { service, credits } = setup({
      settings: {
        ...DEFAULT_VOICE_SETTINGS,
        tts: { ...DEFAULT_VOICE_SETTINGS.tts, creditsPerMinute: 1.2 },
      },
      synthesize: async () => ({
        audio: Buffer.from("x"),
        mimeType: "audio/mpeg",
        durationMs: 130_000,
        voice: "aura-2-celeste-es",
        provider: "deepgram",
      }),
    });
    credits.deduct.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    // 100 when she starts talking (enough), 2 by the time she is charged
    // (spent elsewhere meanwhile), 0 after.
    credits.getBalance
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(2)
      .mockResolvedValue(0);
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

describe("VoiceAssistantService.reply — actions", () => {
  const CREATE =
    '<action>{"name":"calendar.create_event","args":{"title":"Grabar el unboxing","date":"2026-11-28","startTime":"15:00","endTime":"16:00"}}</action>';
  const CREATED = {
    kind: "calendar-event" as const,
    event: {
      id: "ev1",
      title: "Grabar el unboxing",
      type: "RECORDING",
      startAt: "2026-11-28T20:00:00.000Z",
      endAt: "2026-11-28T21:00:00.000Z",
    },
    conflicts: [],
    url: "/tools/content-planner?date=2026-11-28T20%3A00%3A00.000Z",
  };

  function registryWith(
    execute = vi.fn(async () => ({
      ok: true,
      summary:
        'Created "Grabar el unboxing" (RECORDING) on Saturday 2026-11-28 15:00–16:00 (America/Bogota), reminder 15 min before.',
      data: CREATED,
    })),
  ) {
    const registry = new AssistantActionRegistry();
    vi.spyOn(console, "log").mockImplementation(() => {});
    registry.register({
      name: "calendar.create_event",
      toolId: "content-planner",
      description: "Create a session",
      mutates: true,
      parameters: [
        { name: "title", type: "string", required: true, description: "" },
        { name: "date", type: "date", required: true, description: "" },
        { name: "startTime", type: "time", required: true, description: "" },
        { name: "endTime", type: "time", required: false, description: "" },
      ],
      execute,
    });
    return { registry, execute };
  }

  it("creates the event in real time and then confirms it", async () => {
    const { registry, execute } = registryWith();
    const { service, provider, tts, credits } = setup({
      registry,
      rounds: [
        text("Perfecto, lo agendo ahora. ", CREATE),
        text("¡Listo! Quedó para mañana de tres a cuatro."),
      ],
    });
    const { input: req, events } = input({
      content: "Agenda grabar el unboxing mañana de 3 a 4 de la tarde",
      timeZone: "America/Bogota",
    });

    await service.reply(req);

    expect(events.map((e) => e.type)).toEqual([
      "start",
      "delta",
      "audio", // what she said before acting is spoken at once
      "action",
      "action",
      "delta",
      "audio",
      "done",
    ]);
    // The action tag is never shown nor spoken.
    for (const e of ofType(events, "delta"))
      expect(e.content).not.toContain("<");
    for (const [p] of tts.synthesize.mock.calls) {
      expect((p as { text: string }).text).not.toContain("action");
    }
    const [running, done] = ofType(events, "action");
    expect(running).toMatchObject({
      status: "running",
      name: "calendar.create_event",
      args: { title: "Grabar el unboxing", startTime: "15:00" },
    });
    expect(done).toMatchObject({
      id: running!.id,
      status: "done",
      data: CREATED,
    });

    // Run as the user, in their time zone.
    expect(execute).toHaveBeenCalledWith(
      {
        title: "Grabar el unboxing",
        date: "2026-11-28",
        startTime: "15:00",
        endTime: "16:00",
      },
      expect.objectContaining({
        userId: "u1",
        timeZone: "America/Bogota",
        language: "es",
      }),
    );

    // The model got the result and told the user.
    const second = provider.generateStream!.mock.calls[1]![0] as {
      prompt: string;
      parameters: { conversationHistory: Array<{ content: string }> };
    };
    expect(second.prompt).toMatch(
      /^ACTION RESULT \(calendar\.create_event: success\) — Created "Grabar el unboxing"/,
    );
    expect(second.prompt).toContain("in Spanish");
    expect(second.parameters.conversationHistory.slice(-2)).toEqual([
      {
        role: "user",
        content: "Agenda grabar el unboxing mañana de 3 a 4 de la tarde",
      },
      { role: "assistant", content: `Perfecto, lo agendo ahora. ${CREATE}` },
    ]);
    const first = provider.generateStream!.mock.calls[0]![0] as {
      parameters: { systemPrompt: string };
    };
    expect(first.parameters.systemPrompt).toContain("calendar.create_event");
    expect(first.parameters.systemPrompt).toContain(
      "(America/Bogota, UTC-05:00)",
    );

    expect(assistantRow()).toMatchObject({
      content:
        "Perfecto, lo agendo ahora. ¡Listo! Quedó para mañana de tres a cuatro.",
      actions: [
        expect.objectContaining({
          name: "calendar.create_event",
          status: "done",
          data: CREATED,
        }),
      ],
      creditsCharged: 8, // spoken: 3.45 s → 4 started seconds at 120 cr/min
    });
    expect(credits.deduct).toHaveBeenCalledTimes(1);
  });

  it("lets her explain a failed action and ask again", async () => {
    const { registry } = registryWith(
      vi.fn(async () => ({
        ok: false,
        summary:
          "Missing the end time or the duration. Ask the user when it ends.",
      })),
    );
    const { service, provider } = setup({
      registry,
      rounds: [text(CREATE), text("¿Hasta qué hora sería?")],
    });
    const { input: req, events } = input({
      content: "Agenda grabar mañana a las 3",
    });

    await service.reply(req);

    expect(ofType(events, "action")[1]).toMatchObject({ status: "failed" });
    const second = provider.generateStream!.mock.calls[1]![0] as {
      prompt: string;
    };
    expect(second.prompt).toMatch(
      /^ACTION RESULT \(calendar\.create_event: failed\)/,
    );
    expect(assistantRow()).toMatchObject({
      content: "¿Hasta qué hora sería?",
      actions: [expect.objectContaining({ status: "failed" })],
    });
  });

  it("refuses actions that don't exist (or with no registry)", async () => {
    const { service } = setup({
      rounds: [
        text('<action>{"name":"social.post_tweet","args":{}}</action>'),
        text("I can't post for you, sorry."),
      ],
    });
    const { input: req, events } = input({ content: "Post this on X" });

    await service.reply(req);

    expect(ofType(events, "action")[1]).toMatchObject({
      status: "failed",
      summary: 'Unknown action "social.post_tweet"',
    });
  });

  it("runs at most 4 actions in one reply", async () => {
    const { registry, execute } = registryWith();
    const { service, provider } = setup({
      registry,
      rounds: [text(CREATE)], // the model keeps asking for more
    });
    const { input: req } = input({ content: "Agenda cosas" });

    await service.reply(req);

    expect(execute).toHaveBeenCalledTimes(4);
    expect(provider.generateStream).toHaveBeenCalledTimes(5);
  });

  it("keeps the reply when the model fails after the event was created", async () => {
    const { registry } = registryWith();
    const { service, credits } = setup({
      registry,
      rounds: [text(CREATE), [new Error("upstream 500")]],
    });
    const { input: req, events } = input({ content: "Agenda grabar" });

    await service.reply(req);

    expect(prismaMock.voiceConversation.delete).not.toHaveBeenCalled();
    expect(assistantRow()).toMatchObject({
      content: "",
      actions: [expect.objectContaining({ status: "done" })],
    });
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      1,
      "voice-assistant",
      expect.stringContaining('Created "Grabar el unboxing"'),
    );
    expect(events.at(-1)!.type).toBe("done");
  });

  it("falls back to UTC for an unknown time zone", async () => {
    const { registry, execute } = registryWith();
    const { service } = setup({
      registry,
      rounds: [text(CREATE), text("Done.")],
    });
    const { input: req } = input({ timeZone: "Mars/Olympus" });
    await service.reply(req);
    expect(execute.mock.calls[0]![1]).toMatchObject({ timeZone: "UTC" });
  });

  it("remembers past actions in the conversation history", async () => {
    const { service, provider } = setup({ chunks: text("Claro.") });
    prismaMock.voiceConversation.findFirst.mockResolvedValue({
      id: "conv9",
      title: "Old",
      language: "es",
    });
    prismaMock.voiceMessage.findMany.mockResolvedValue([
      {
        role: "assistant",
        content: "¡Listo!",
        actions: [
          {
            id: "a1",
            name: "calendar.create_event",
            status: "done",
            args: {},
            summary: 'Created "Grabar"',
          },
        ],
      },
      { role: "user", content: "Agenda grabar", actions: null },
    ]);
    const { input: req } = input({
      conversationId: "conv9",
      content: "¿y luego?",
    });

    await service.reply(req);

    const request = provider.generateStream!.mock.calls[0]![0] as {
      parameters: { conversationHistory: unknown };
    };
    expect(request.parameters.conversationHistory).toEqual([
      { role: "user", content: "Agenda grabar" },
      {
        role: "assistant",
        content: '¡Listo!\n[calendar.create_event done: Created "Grabar"]',
      },
    ]);
  });

  it("returns the actions of past replies with the conversation", async () => {
    const { service } = setup();
    const at = new Date("2026-11-27T10:00:00Z");
    prismaMock.voiceConversation.findFirst.mockResolvedValue({
      id: "c1",
      title: "Hi",
      language: "es",
      createdAt: at,
      updatedAt: at,
      messages: [
        {
          id: "m2",
          role: "assistant",
          content: "¡Listo!",
          language: "es",
          spoken: true,
          voice: null,
          audioMs: 0,
          creditsCharged: 1,
          interrupted: false,
          actions: [
            {
              id: "a1",
              name: "calendar.create_event",
              status: "done",
              args: {},
            },
          ],
          createdAt: at,
        },
      ],
    });
    const detail = await service.getConversation("u1", "c1");
    expect(detail.messages[0]!.actions).toEqual([
      { id: "a1", name: "calendar.create_event", status: "done", args: {} },
    ]);
  });
});

describe("VoiceAssistantService.reply — she said she'd do it but didn't", () => {
  const LIST =
    '<action>{"name":"calendar.list_events","args":{"date":"2026-11-28"}}</action>';

  function agendaRegistry() {
    const registry = new AssistantActionRegistry();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const execute = vi.fn(async () => ({
      ok: true,
      summary: "2 session(s) for 2026-11-28",
    }));
    registry.register({
      name: "calendar.list_events",
      toolId: "content-planner",
      description: "Read the agenda",
      mutates: false,
      parameters: [
        { name: "date", type: "date", required: true, description: "" },
      ],
      execute,
    });
    return { registry, execute };
  }

  it("nudges the model once in the same reply, so the search really happens", async () => {
    const { registry, execute } = agendaRegistry();
    const { service, provider } = setup({
      registry,
      rounds: [
        text("Ok, lo busco en este momento."), // announced, no action
        text(LIST), // after the nudge
        text("Mañana tienes dos sesiones."),
      ],
    });
    const { input: req, events } = input({
      content: "¿Tengo algún plan para mañana?",
    });

    await service.reply(req);

    expect(execute).toHaveBeenCalledTimes(1);
    const nudge = provider.generateStream!.mock.calls[1]![0] as {
      prompt: string;
      parameters: { conversationHistory: Array<{ content: string }> };
    };
    expect(nudge.prompt).toMatch(
      /^SYSTEM NOTE \(not from the user\): you told the user you would do it, but you did not write the action/,
    );
    expect(nudge.prompt).toContain("in Spanish");
    expect(nudge.parameters.conversationHistory.at(-1)).toEqual({
      role: "assistant",
      content: "Ok, lo busco en este momento.",
    });
    expect(
      events
        .map((e) => (e.type === "action" ? `action:${e.status}` : e.type))
        .filter((t, i, all) => t !== "delta" || all[i - 1] !== "delta"),
    ).toEqual([
      "start",
      "delta",
      "audio",
      "action:running",
      "action:done",
      "delta",
      "audio",
      "done",
    ]);
    expect(assistantRow()).toMatchObject({
      content: "Ok, lo busco en este momento. Mañana tienes dos sesiones.",
      actions: [expect.objectContaining({ status: "done" })],
    });
  });

  it("asks again for an action it couldn't read", async () => {
    const { registry, execute } = agendaRegistry();
    const { service, provider } = setup({
      registry,
      rounds: [
        text("Let me check. <action>list my events for tomorrow</action>"),
        text(LIST),
        text("You have two sessions."),
      ],
    });
    const { input: req } = input({ content: "Do I have plans tomorrow?" });

    await service.reply(req);

    const nudge = provider.generateStream!.mock.calls[1]![0] as {
      prompt: string;
    };
    expect(nudge.prompt).toContain("your action could not be read");
    expect(nudge.prompt).toContain("list my events for tomorrow");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("nudges only once per reply", async () => {
    const { registry, execute } = agendaRegistry();
    const { service, provider } = setup({
      registry,
      rounds: [
        text("Un momento, lo reviso."),
        text("Un momento, ya lo reviso."),
      ],
    });
    const { input: req } = input({ content: "¿Tengo planes?" });

    await service.reply(req);

    expect(provider.generateStream).toHaveBeenCalledTimes(2);
    expect(execute).not.toHaveBeenCalled();
  });

  it("doesn't nudge normal answers, nor when she has no actions", async () => {
    const { registry } = agendaRegistry();
    const withActions = setup({
      registry,
      rounds: [text("¿A qué hora empieza?")],
    });
    await withActions.service.reply(
      input({ content: "Agenda grabar mañana" }).input,
    );
    expect(withActions.provider.generateStream).toHaveBeenCalledTimes(1);

    const noActions = setup({ rounds: [text("Un momento, lo busco.")] });
    await noActions.service.reply(input({ content: "¿Tengo planes?" }).input);
    expect(noActions.provider.generateStream).toHaveBeenCalledTimes(1);
  });
});

describe("VoiceAssistantService.reply — deleting needs the user's confirmation", () => {
  const DELETE =
    '<action>{"name":"calendar.delete_event","args":{"eventId":"ev1"}}</action>';
  const PREVIEW = {
    kind: "calendar-event" as const,
    change: "deleted" as const,
    event: {
      id: "ev1",
      title: "Grabar",
      type: "RECORDING",
      startAt: "2026-11-28T20:00:00.000Z",
      endAt: "2026-11-28T21:00:00.000Z",
    },
    conflicts: [],
    url: "/tools/content-planner",
  };

  function deleteRegistry() {
    const registry = new AssistantActionRegistry();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const execute = vi.fn(async () => ({
      ok: true,
      summary: 'Deleted "Grabar" Saturday 15:00–16:00.',
      data: PREVIEW,
    }));
    const describe_ = vi.fn(async () => ({
      ok: true,
      summary: 'Would delete "Grabar" Saturday 15:00–16:00 for good.',
      data: PREVIEW,
    }));
    registry.register({
      name: "calendar.delete_event",
      toolId: "content-planner",
      description: "Delete a session",
      mutates: true,
      requiresConfirmation: true,
      parameters: [
        { name: "eventId", type: "string", required: true, description: "" },
      ],
      describe: describe_,
      execute,
    });
    return { registry, execute, describe: describe_ };
  }

  const pendingRecord = (args = { eventId: "ev1" }) => ({
    id: "a0",
    name: "calendar.delete_event",
    args,
    status: "needs_confirmation",
    summary: "NOT DONE YET",
  });

  function previousReply(actions: unknown[], minutesAgo = 1) {
    prismaMock.voiceConversation.findFirst.mockResolvedValue({
      id: "conv9",
      title: "Old",
      language: "es",
    });
    prismaMock.voiceMessage.findFirst.mockResolvedValue({
      actions,
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
    });
  }

  it("the first request only previews and asks the user", async () => {
    const { registry, execute, describe: describe_ } = deleteRegistry();
    const { service, provider } = setup({
      registry,
      rounds: [
        text(DELETE),
        text('¿Seguro que borro "Grabar" del sábado a las tres?'),
      ],
    });
    const { input: req, events } = input({
      content: "Borra la grabación del sábado",
    });

    await service.reply(req);

    expect(describe_).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(ofType(events, "action")[1]).toMatchObject({
      status: "needs_confirmation",
      data: PREVIEW,
    });
    const second = provider.generateStream!.mock.calls[1]![0] as {
      prompt: string;
    };
    expect(second.prompt).toMatch(
      /^ACTION RESULT \(calendar\.delete_event: needs confirmation\) — NOT DONE YET/,
    );
    expect(second.prompt).toContain("Now ask the user to confirm");
    expect(assistantRow()).toMatchObject({
      actions: [expect.objectContaining({ status: "needs_confirmation" })],
    });
  });

  it("she can't confirm it herself in the same reply", async () => {
    const { registry, execute } = deleteRegistry();
    const { service } = setup({
      registry,
      rounds: [text(DELETE)], // keeps asking for the delete
    });
    const { input: req, events } = input({ content: "Borra la grabación" });

    await service.reply(req);

    expect(execute).not.toHaveBeenCalled();
    expect(
      ofType(events, "action")
        .filter((e) => e.status !== "running")
        .map((e) => e.status),
    ).toEqual([
      "needs_confirmation",
      "needs_confirmation",
      "needs_confirmation",
      "needs_confirmation",
    ]);
  });

  it("runs after the user's yes in the next message", async () => {
    const { registry, execute } = deleteRegistry();
    previousReply([pendingRecord()]);
    const { service } = setup({
      registry,
      rounds: [text(DELETE), text("Listo, la borré.")],
    });
    const { input: req, events } = input({
      conversationId: "conv9",
      content: "Sí",
    });

    await service.reply(req);

    expect(prismaMock.voiceMessage.findFirst).toHaveBeenCalledWith({
      where: { conversationId: "conv9", role: "assistant" },
      orderBy: { createdAt: "desc" },
      select: { actions: true, createdAt: true },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(ofType(events, "action")[1]).toMatchObject({ status: "done" });
  });

  it("a yes confirms that exact action once", async () => {
    const { registry, execute } = deleteRegistry();
    previousReply([pendingRecord()]);
    const { service } = setup({
      registry,
      rounds: [
        text(DELETE),
        text(DELETE), // again in the same reply: not confirmed twice
        text("Listo."),
      ],
    });
    await service.reply(
      input({ conversationId: "conv9", content: "Sí" }).input,
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("doesn't accept a yes for something else, or an old one", async () => {
    const other = deleteRegistry();
    previousReply([pendingRecord({ eventId: "ev2" })]);
    const a = setup({
      registry: other.registry,
      rounds: [text(DELETE), text("¿Seguro?")],
    });
    await a.service.reply(
      input({ conversationId: "conv9", content: "Sí" }).input,
    );
    expect(other.execute).not.toHaveBeenCalled();

    const stale = deleteRegistry();
    previousReply([pendingRecord()], 20);
    const b = setup({
      registry: stale.registry,
      rounds: [text(DELETE), text("¿Seguro?")],
    });
    await b.service.reply(
      input({ conversationId: "conv9", content: "Sí" }).input,
    );
    expect(stale.execute).not.toHaveBeenCalled();
  });

  it("reports a preview that can't be made (unknown id) as failed", async () => {
    const { registry, describe: describe_, execute } = deleteRegistry();
    describe_.mockResolvedValueOnce({
      ok: false,
      summary: "No session with id ev1.",
    });
    const { service } = setup({
      registry,
      rounds: [text(DELETE), text("No la encuentro.")],
    });
    const { input: req, events } = input({ content: "Borra la grabación" });
    await service.reply(req);
    expect(ofType(events, "action")[1]).toMatchObject({
      status: "failed",
      summary: "No session with id ev1.",
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
