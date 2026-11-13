import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { CredentialCipher } from "@creator-hub/community-bot";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { CommunityBotConfigService } from "../services/community-bot-config.service";
import { ChannelService } from "../services/channel.service";
import { ConversationService } from "../services/conversation.service";
import { PlaygroundService } from "../services/playground.service";

beforeEach(() => resetPrismaMock());

describe("CommunityBotConfigService", () => {
  const service = new CommunityBotConfigService();

  it("returns the existing config without creating a new one", async () => {
    prismaMock.communityBotConfig.findUnique.mockResolvedValue({
      userId: "u1",
    });

    await service.getOrCreate("u1");

    expect(prismaMock.communityBotConfig.create).not.toHaveBeenCalled();
  });

  it("lazily creates a config with database defaults", async () => {
    prismaMock.communityBotConfig.findUnique.mockResolvedValue(null);

    await service.getOrCreate("u1");

    expect(prismaMock.communityBotConfig.create).toHaveBeenCalledWith({
      data: { userId: "u1" },
    });
  });

  it("rejects a model that is not an active chat model", async () => {
    prismaMock.modelMetadata.findFirst.mockResolvedValue(null);

    await expect(
      service.update("u1", { modelId: "img-model" }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.modelMetadata.findFirst).toHaveBeenCalledWith({
      where: {
        modelId: "img-model",
        isActive: true,
        taskType: { in: ["text-generation", "chat"] },
      },
      select: { tier: true },
    });
    expect(prismaMock.communityBotConfig.update).not.toHaveBeenCalled();
  });

  it("blocks FREE-plan users from selecting PRO models", async () => {
    prismaMock.modelMetadata.findFirst.mockResolvedValue({ tier: "PRO" });
    prismaMock.user.findUnique.mockResolvedValue({ plan: "FREE" });

    await expect(
      service.update("u1", { modelId: "pro-model" }),
    ).rejects.toThrow(ForbiddenException);
    expect(prismaMock.communityBotConfig.update).not.toHaveBeenCalled();
  });

  it("lets paid users select PRO models", async () => {
    prismaMock.modelMetadata.findFirst.mockResolvedValue({ tier: "PRO" });
    prismaMock.user.findUnique.mockResolvedValue({ plan: "PRO" });
    prismaMock.communityBotConfig.findUnique.mockResolvedValue({
      userId: "u1",
    });

    await service.update("u1", { modelId: "pro-model" });

    expect(prismaMock.communityBotConfig.update).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { modelId: "pro-model" },
    });
  });

  it("only updates the provided fields, including falsy values", async () => {
    prismaMock.communityBotConfig.findUnique.mockResolvedValue(null);

    await service.update("u1", {
      isEnabled: false,
      historyLength: 0,
      systemPromptExtra: "",
    });

    expect(prismaMock.communityBotConfig.create).toHaveBeenCalled();
    expect(prismaMock.communityBotConfig.update).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { isEnabled: false, historyLength: 0, systemPromptExtra: "" },
    });
    expect(prismaMock.modelMetadata.findFirst).not.toHaveBeenCalled();
  });
});

describe("ChannelService", () => {
  const commandQueue = { add: vi.fn() };
  const fetchMock = vi.fn();
  const service = new ChannelService(commandQueue as never);
  const originalKey = process.env.COMMUNITY_BOT_ENCRYPTION_KEY;
  const BOT_TOKEN = "123456789:AAE-secret-token";

  const telegramReplies = (body: unknown) =>
    fetchMock.mockResolvedValue({ json: async () => body });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.COMMUNITY_BOT_ENCRYPTION_KEY = "test-encryption-key";
    prismaMock.communityChannel.upsert.mockResolvedValue({ id: "ch1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.COMMUNITY_BOT_ENCRYPTION_KEY = originalKey;
  });

  describe("connectTelegram", () => {
    it("validates the token with Telegram, stores it encrypted and enqueues CONNECT", async () => {
      telegramReplies({ ok: true, result: { username: "my_fan_bot" } });

      const channel = await service.connectTelegram("u1", BOT_TOKEN);

      expect(channel).toEqual({ id: "ch1" });
      expect(fetchMock.mock.calls[0]![0]).toBe(
        `https://api.telegram.org/bot${BOT_TOKEN}/getMe`,
      );

      const upsert = prismaMock.communityChannel.upsert.mock.calls[0]![0];
      expect(upsert.where).toEqual({
        userId_type: { userId: "u1", type: "TELEGRAM" },
      });
      expect(upsert.create.externalIdentity).toBe("@my_fan_bot");
      expect(upsert.create.status).toBe("CONNECTING");
      // Credentials are encrypted at rest and decrypt back to the token.
      expect(upsert.create.credentials).not.toContain(BOT_TOKEN);
      expect(
        new CredentialCipher("test-encryption-key").decryptJson(
          upsert.create.credentials,
        ),
      ).toEqual({ botToken: BOT_TOKEN });
      // The response select never includes the credentials column.
      expect(upsert.select.credentials).toBeUndefined();
      expect(upsert.update.lastError).toBeNull();

      expect(commandQueue.add).toHaveBeenCalledWith(
        "channel-command",
        {
          action: "CONNECT",
          channelId: "ch1",
          userId: "u1",
          channelType: "TELEGRAM",
        },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        }),
      );
    });

    it("rejects a token Telegram does not accept, storing nothing", async () => {
      telegramReplies({ ok: false, description: "Unauthorized" });

      await expect(service.connectTelegram("u1", BOT_TOKEN)).rejects.toThrow(
        /Telegram rejected this bot token/,
      );
      expect(prismaMock.communityChannel.upsert).not.toHaveBeenCalled();
      expect(commandQueue.add).not.toHaveBeenCalled();
    });

    it("reports network failures as a retryable bad request", async () => {
      fetchMock.mockRejectedValue(new Error("ECONNRESET"));

      await expect(service.connectTelegram("u1", BOT_TOKEN)).rejects.toThrow(
        "Could not reach Telegram to validate the token — try again",
      );
      expect(prismaMock.communityChannel.upsert).not.toHaveBeenCalled();
    });

    it("refuses to store credentials when the encryption key is missing", async () => {
      telegramReplies({ ok: true, result: { username: "bot" } });
      delete process.env.COMMUNITY_BOT_ENCRYPTION_KEY;

      await expect(service.connectTelegram("u1", BOT_TOKEN)).rejects.toThrow(
        /COMMUNITY_BOT_ENCRYPTION_KEY is not set/,
      );
      expect(prismaMock.communityChannel.upsert).not.toHaveBeenCalled();
    });
  });

  it("connectWhatsApp waits for QR pairing and enqueues CONNECT", async () => {
    await service.connectWhatsApp("u1");

    const upsert = prismaMock.communityChannel.upsert.mock.calls[0]![0];
    expect(upsert.create.status).toBe("AWAITING_QR");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(commandQueue.add.mock.calls[0]![1]).toEqual({
      action: "CONNECT",
      channelId: "ch1",
      userId: "u1",
      channelType: "WHATSAPP",
    });
  });

  describe("disconnect", () => {
    it("throws NotFound when the user has no channel of that type", async () => {
      prismaMock.communityChannel.findUnique.mockResolvedValue(null);

      await expect(service.disconnect("u1", "TELEGRAM")).rejects.toThrow(
        NotFoundException,
      );
      expect(commandQueue.add).not.toHaveBeenCalled();
    });

    it("enqueues DISCONNECT and optimistically marks the channel disconnected", async () => {
      prismaMock.communityChannel.findUnique.mockResolvedValue({ id: "ch1" });

      await service.disconnect("u1", "WHATSAPP");

      expect(prismaMock.communityChannel.findUnique).toHaveBeenCalledWith({
        where: { userId_type: { userId: "u1", type: "WHATSAPP" } },
      });
      expect(commandQueue.add.mock.calls[0]![1]).toMatchObject({
        action: "DISCONNECT",
      });
      expect(
        prismaMock.communityChannel.update.mock.calls[0]![0],
      ).toMatchObject({
        where: { id: "ch1" },
        data: { status: "DISCONNECTED" },
      });
    });
  });

  it("lists only the user's channels without credentials", async () => {
    await service.list("u1");

    const args = prismaMock.communityChannel.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: "u1" });
    expect(args.select.credentials).toBeUndefined();
  });
});

describe("ConversationService", () => {
  const service = new ConversationService();

  it("lists conversations scoped to the user's channels with pagination", async () => {
    prismaMock.communityConversation.count.mockResolvedValue(45);
    prismaMock.communityConversation.findMany.mockResolvedValue([{ id: "c1" }]);

    const result = await service.listConversations("u1", 3, 20);

    const args = prismaMock.communityConversation.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ channel: { userId: "u1" } });
    expect(args.skip).toBe(40);
    expect(result.meta).toEqual({
      page: 3,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("hides conversations that belong to another creator", async () => {
    prismaMock.communityConversation.findFirst.mockResolvedValue(null);

    await expect(service.listMessages("u1", "c-of-u2", 1, 50)).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.communityConversation.findFirst).toHaveBeenCalledWith({
      where: { id: "c-of-u2", channel: { userId: "u1" } },
      select: { id: true },
    });
    expect(prismaMock.communityMessage.findMany).not.toHaveBeenCalled();
  });

  it("returns messages in chronological order", async () => {
    prismaMock.communityConversation.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.communityMessage.count.mockResolvedValue(2);
    prismaMock.communityMessage.findMany.mockResolvedValue([
      { id: "newest" },
      { id: "oldest" },
    ]);

    const result = await service.listMessages("u1", "c1", 1, 50);

    expect(result.data.map((m: { id: string }) => m.id)).toEqual([
      "oldest",
      "newest",
    ]);
    expect(
      prismaMock.communityMessage.findMany.mock.calls[0]![0].orderBy,
    ).toEqual({
      createdAt: "desc",
    });
  });
});

describe("PlaygroundService", () => {
  const aiEngine = { execute: vi.fn() };
  const creditService = {
    hasEnoughCredits: vi.fn(),
    deduct: vi.fn(),
    getBalance: vi.fn(),
  };
  const styleContext = { buildSystemPrompt: vi.fn() };
  const service = new PlaygroundService(
    aiEngine as never,
    creditService as never,
    styleContext as never,
  );
  const config = {
    modelId: "deepseek-ai/DeepSeek-V4-Flash",
    useStyleProfile: true,
    systemPromptExtra: "Be kind",
    temperature: 0.6,
    maxTokens: 300,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    prismaMock.communityBotConfig.findUnique.mockResolvedValue(config);
    prismaMock.modelMetadata.findFirst.mockResolvedValue({ creditCost: 2 });
    creditService.hasEnoughCredits.mockResolvedValue(true);
    creditService.deduct.mockResolvedValue(true);
    creditService.getBalance.mockResolvedValue(98);
    styleContext.buildSystemPrompt.mockResolvedValue("STYLE PROMPT");
    aiEngine.execute.mockResolvedValue({
      model: "deepseek-ai/DeepSeek-V4-Flash",
      output: { type: "text", content: "  Thanks for watching!  " },
    });
  });

  it("requires the bot to be configured first", async () => {
    prismaMock.communityBotConfig.findUnique.mockResolvedValue(null);

    await expect(service.generatePreview("u1", "hi")).rejects.toThrow(
      BadRequestException,
    );
    expect(aiEngine.execute).not.toHaveBeenCalled();
  });

  it("returns 402 before calling the AI when credits are insufficient", async () => {
    creditService.hasEnoughCredits.mockResolvedValue(false);

    const error = await service
      .generatePreview("u1", "hi")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.PAYMENT_REQUIRED,
    );
    expect(aiEngine.execute).not.toHaveBeenCalled();
  });

  it("generates a reply with the configured model and charges its credit cost", async () => {
    const result = await service.generatePreview("u1", "Loved the video");

    expect(styleContext.buildSystemPrompt).toHaveBeenCalledWith({
      userId: "u1",
      useStyleProfile: true,
      systemPromptExtra: "Be kind",
    });
    expect(aiEngine.execute).toHaveBeenCalledWith({
      taskType: "text-generation",
      model: config.modelId,
      prompt: "Loved the video",
      parameters: {
        systemPrompt: "STYLE PROMPT",
        temperature: 0.6,
        maxTokens: 300,
      },
      userId: "u1",
    });
    expect(creditService.deduct).toHaveBeenCalledWith(
      "u1",
      2,
      undefined,
      "Community bot playground preview",
    );
    expect(result).toEqual({
      reply: "Thanks for watching!",
      modelId: config.modelId,
      creditsUsed: 2,
      balance: 98,
    });
  });

  it("defaults to 1 credit when the model has no metadata", async () => {
    prismaMock.modelMetadata.findFirst.mockResolvedValue(null);

    const result = await service.generatePreview("u1", "hi");

    expect(creditService.hasEnoughCredits).toHaveBeenCalledWith("u1", 1);
    expect(result.creditsUsed).toBe(1);
  });

  it("does not charge for an empty AI reply", async () => {
    aiEngine.execute.mockResolvedValue({
      output: { type: "text", content: "   " },
    });

    await expect(service.generatePreview("u1", "hi")).rejects.toThrow(
      /empty reply/,
    );
    expect(creditService.deduct).not.toHaveBeenCalled();
  });

  it("returns 402 when the balance changed before charging", async () => {
    creditService.deduct.mockResolvedValue(false);

    const error = await service
      .generatePreview("u1", "hi")
      .catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.PAYMENT_REQUIRED,
    );
    expect(creditService.getBalance).not.toHaveBeenCalled();
  });
});
