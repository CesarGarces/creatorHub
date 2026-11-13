import { describe, expect, expectTypeOf, it } from "vitest";
import * as types from "../index";
import type {
  AIResponse,
  CommunityChannelType,
  ToolJobUpdatePayload,
  ToolManifest,
} from "../index";

/**
 * shared-types is mostly compile-time types. Its runtime values are the
 * contract between the API and the community-worker (queue names, Redis
 * pub/sub channels, STT limits) — changing one breaks the other process
 * silently, so they are pinned here.
 */
describe("community-bot wire contract", () => {
  it("pins the BullMQ queue names", () => {
    expect(types.COMMUNITY_INBOUND_QUEUE).toBe("community-inbound");
    expect(types.COMMUNITY_OUTBOUND_QUEUE).toBe("community-outbound");
    expect(types.COMMUNITY_CHANNEL_COMMAND_QUEUE).toBe(
      "community-channel-commands",
    );
  });

  it("pins the Redis pub/sub channel names", () => {
    expect(types.COMMUNITY_CHANNEL_STATUS_EVENT).toBe(
      "community.channel.status",
    );
    expect(types.COMMUNITY_MESSAGE_RECEIVED_EVENT).toBe(
      "community.message.received",
    );
    expect(types.COMMUNITY_REPLY_SENT_EVENT).toBe("community.reply.sent");
    expect(types.COMMUNITY_REPLY_SKIPPED_EVENT).toBe("community.reply.skipped");
  });

  it("uses distinct names for every queue and channel", () => {
    const names = [
      types.COMMUNITY_INBOUND_QUEUE,
      types.COMMUNITY_OUTBOUND_QUEUE,
      types.COMMUNITY_CHANNEL_COMMAND_QUEUE,
      types.COMMUNITY_CHANNEL_STATUS_EVENT,
      types.COMMUNITY_MESSAGE_RECEIVED_EVENT,
      types.COMMUNITY_REPLY_SENT_EVENT,
      types.COMMUNITY_REPLY_SKIPPED_EVENT,
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("speech-to-text limits", () => {
  it("keeps sessions to 3 minutes at 1 credit per minute, requiring 5 credits", () => {
    expect(types.MAX_STT_SESSION_MS).toBe(180_000);
    expect(types.STT_CREDITS_PER_MINUTE).toBe(1);
    expect(types.MIN_CREDITS_FOR_STT).toBe(5);
    // A full-length session must be affordable with the minimum balance.
    expect(
      (types.MAX_STT_SESSION_MS / 60_000) * types.STT_CREDITS_PER_MINUTE,
    ).toBeLessThanOrEqual(types.MIN_CREDITS_FOR_STT);
  });
});

describe("type contracts", () => {
  it("ToolManifest requires the fields the registry relies on", () => {
    expectTypeOf<ToolManifest>().toHaveProperty("id").toEqualTypeOf<string>();
    expectTypeOf<ToolManifest>()
      .toHaveProperty("creditsPerUse")
      .toEqualTypeOf<number>();
    expectTypeOf<ToolManifest["status"]>().toEqualTypeOf<
      "active" | "inactive" | "beta" | "deprecated"
    >();
  });

  it("community channels are Telegram, WhatsApp or Instagram", () => {
    expectTypeOf<CommunityChannelType>().toEqualTypeOf<
      "TELEGRAM" | "WHATSAPP" | "INSTAGRAM"
    >();
  });

  it("tool job updates carry a status the frontend understands", () => {
    expectTypeOf<ToolJobUpdatePayload["status"]>().toMatchTypeOf<string>();
    expectTypeOf<AIResponse>().toHaveProperty("provider");
  });
});
