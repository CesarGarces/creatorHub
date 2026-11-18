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

describe("dashboard widgets contract", () => {
  const ids = (list: { id: string }[]) => list.map((w) => w.id);

  it("pins the widget ids stored in user layouts", () => {
    // Stored in DashboardLayout.widgets — renaming one drops it from layouts.
    expect(types.DASHBOARD_WIDGET_IDS).toEqual([
      "quick-prompt",
      "favorites",
      "today-plans",
      "activity",
      "recommendations",
      "credits",
      "tips",
      "asset-stats",
    ]);
  });

  it("the default layout lists every widget exactly once", () => {
    const defaults = ids([...types.DEFAULT_DASHBOARD_WIDGETS]);
    expect([...defaults].sort()).toEqual(
      [...types.DASHBOARD_WIDGET_IDS].sort(),
    );
  });

  it("anything that isn't a list normalizes to the default layout", () => {
    for (const value of [undefined, null, {}, "x", 42]) {
      expect(types.normalizeDashboardWidgets(value)).toEqual(
        types.DEFAULT_DASHBOARD_WIDGETS,
      );
    }
  });

  it("keeps the saved order and visibility, appends missing widgets", () => {
    const result = types.normalizeDashboardWidgets([
      { id: "tips", visible: false },
      { id: "credits", visible: true },
    ]);
    expect(result.slice(0, 2)).toEqual([
      { id: "tips", visible: false },
      { id: "credits", visible: true },
    ]);
    expect(ids(result)).toEqual([
      "tips",
      "credits",
      "quick-prompt",
      "favorites",
      "today-plans",
      "activity",
      "recommendations",
      "asset-stats",
    ]);
    expect(result.every((w) => w.visible !== undefined)).toBe(true);
  });

  it("drops unknown ids, duplicates and malformed entries", () => {
    const result = types.normalizeDashboardWidgets([
      { id: "activity", visible: false },
      { id: "activity", visible: true },
      { id: "weather", visible: true },
      null,
      "favorites",
      { id: "favorites", visible: "yes" },
    ]);
    expect(result[0]).toEqual({ id: "activity", visible: false });
    // Non-boolean visibility falls back to the widget's default (shown).
    expect(result[1]).toEqual({ id: "favorites", visible: true });
    expect(ids(result)).toHaveLength(types.DASHBOARD_WIDGET_IDS.length);
    expect(new Set(ids(result)).size).toBe(result.length);
  });

  it("returns fresh objects (the defaults can't be mutated through it)", () => {
    const result = types.normalizeDashboardWidgets(undefined);
    result[0]!.visible = !result[0]!.visible;
    expect(types.DEFAULT_DASHBOARD_WIDGETS[0]!.visible).toBe(true);
  });

  it("a widget added after a layout was saved shows up, at the end", () => {
    const saved = types.DEFAULT_DASHBOARD_WIDGETS.filter(
      (w) => w.id !== "today-plans",
    );
    const result = types.normalizeDashboardWidgets(saved);
    expect(result.at(-1)).toEqual({ id: "today-plans", visible: true });
  });

  it("recognizes widget ids", () => {
    expect(types.isDashboardWidgetId("today-plans")).toBe(true);
    expect(types.isDashboardWidgetId("favorites")).toBe(true);
    expect(types.isDashboardWidgetId("weather")).toBe(false);
    expect(types.isDashboardWidgetId(1)).toBe(false);
  });
});

describe("asset engagement contract", () => {
  it("bounds the top list", () => {
    expect(types.ASSET_ENGAGEMENT_DEFAULT_TOP).toBe(4);
    expect(types.ASSET_ENGAGEMENT_MAX_TOP).toBeGreaterThanOrEqual(
      types.ASSET_ENGAGEMENT_DEFAULT_TOP,
    );
  });
});
