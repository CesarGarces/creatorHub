import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";
import {
  COMMUNITY_CHANNEL_STATUS_EVENT,
  COMMUNITY_MESSAGE_RECEIVED_EVENT,
  COMMUNITY_REPLY_SENT_EVENT,
  COMMUNITY_REPLY_SKIPPED_EVENT,
} from "@creator-hub/shared-types";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import { CommunityBotController } from "../community-bot.controller";
import { CommunityBotListenerService } from "../community-bot.listener.service";

describe("CommunityBotController", () => {
  const configService = { getOrCreate: vi.fn(), update: vi.fn() };
  const channelService = {
    list: vi.fn(),
    connectTelegram: vi.fn(),
    connectWhatsApp: vi.fn(),
    disconnect: vi.fn(),
  };
  const conversationService = {
    listConversations: vi.fn(),
    listMessages: vi.fn(),
  };
  const playgroundService = { generatePreview: vi.fn() };
  const controller = new CommunityBotController(
    configService as never,
    channelService as never,
    conversationService as never,
    playgroundService as never,
  );

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, CommunityBotController),
    ).toEqual([JwtAuthGuard]);
  });

  it("wraps config and channel results in a success envelope", async () => {
    configService.getOrCreate.mockResolvedValue({ isEnabled: false });
    channelService.connectTelegram.mockResolvedValue({ id: "ch1" });

    expect(await controller.getConfig("u1")).toEqual({
      success: true,
      data: { isEnabled: false },
    });
    expect(
      await controller.connectTelegram("u1", { botToken: "1:abc" }),
    ).toEqual({ success: true, data: { id: "ch1" } });
    expect(channelService.connectTelegram).toHaveBeenCalledWith("u1", "1:abc");
  });

  it("normalizes the channel type before disconnecting", async () => {
    channelService.disconnect.mockResolvedValue({ status: "DISCONNECTED" });

    await controller.disconnectChannel("u1", "telegram");

    expect(channelService.disconnect).toHaveBeenCalledWith("u1", "TELEGRAM");
  });

  it("rejects unknown channel types without touching the service", async () => {
    expect(await controller.disconnectChannel("u1", "myspace")).toEqual({
      success: false,
      error: { message: "Unknown channel type" },
    });
    expect(channelService.disconnect).not.toHaveBeenCalled();
  });

  it("scopes conversation queries to the current user", async () => {
    await controller.listConversations("u1", 2, 10);
    await controller.listMessages("u1", "c1", 1, 50);

    expect(conversationService.listConversations).toHaveBeenCalledWith(
      "u1",
      2,
      10,
    );
    expect(conversationService.listMessages).toHaveBeenCalledWith(
      "u1",
      "c1",
      1,
      50,
    );
  });

  it("runs a playground preview for the current user", async () => {
    playgroundService.generatePreview.mockResolvedValue({ reply: "hi!" });

    expect(await controller.playground("u1", { message: "hello" })).toEqual({
      success: true,
      data: { reply: "hi!" },
    });
    expect(playgroundService.generatePreview).toHaveBeenCalledWith(
      "u1",
      "hello",
    );
  });
});

describe("CommunityBotListenerService", () => {
  const handlers = new Map<string, (event: unknown) => void>();
  const subscriber = {
    subscribe: vi.fn(
      async (channel: string, handler: (event: unknown) => void) => {
        handlers.set(channel, handler);
      },
    ),
    unsubscribe: vi.fn(),
  };
  const gateway = { emitToUser: vi.fn() };
  const service = new CommunityBotListenerService(
    subscriber as never,
    gateway as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it.each([
    [COMMUNITY_CHANNEL_STATUS_EVENT, "community:channel_status"],
    [COMMUNITY_MESSAGE_RECEIVED_EVENT, "community:message_received"],
    [COMMUNITY_REPLY_SENT_EVENT, "community:reply_sent"],
    [COMMUNITY_REPLY_SKIPPED_EVENT, "community:reply_skipped"],
  ])("forwards %s to the owner's socket as %s", async (channel, wsEvent) => {
    await service.onModuleInit();
    const event = { userId: "creator-1", channelId: "ch1" };

    handlers.get(channel)!(event);

    expect(gateway.emitToUser).toHaveBeenCalledWith(
      "creator-1",
      wsEvent,
      event,
    );
  });

  it("unsubscribes from all four channels on shutdown", async () => {
    await service.onModuleDestroy();

    expect(subscriber.unsubscribe.mock.calls.map((c) => c[0])).toEqual([
      COMMUNITY_CHANNEL_STATUS_EVENT,
      COMMUNITY_MESSAGE_RECEIVED_EVENT,
      COMMUNITY_REPLY_SENT_EVENT,
      COMMUNITY_REPLY_SKIPPED_EVENT,
    ]);
  });
});
