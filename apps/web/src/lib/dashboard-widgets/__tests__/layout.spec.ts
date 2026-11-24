import { beforeEach, describe, expect, it } from "vitest";
import {
  DASHBOARD_WIDGET_IDS,
  DEFAULT_DASHBOARD_WIDGETS,
  type DashboardWidgetState,
} from "@creator-hub/shared-types";
import { getMessages } from "@/i18n/translate";
import { ALL_WIDGETS, spanClass, WIDGET_CATALOG } from "../catalog";
import { canStartWidgetDrag, NO_WIDGET_DRAG } from "../drag";
import {
  defaultWidgets,
  isDefaultLayout,
  moveWidget,
  reorderVisible,
  sameWidgets,
  setWidgetVisible,
  visibleWidgetIds,
} from "../layout";
import { readCachedLayout, writeCachedLayout } from "../layout-cache";

const list = (...entries: [string, boolean][]): DashboardWidgetState[] =>
  entries.map(([id, visible]) => ({
    id: id as DashboardWidgetState["id"],
    visible,
  }));

const ids = (widgets: readonly { id: string }[]) => widgets.map((w) => w.id);

describe("widget catalog", () => {
  it("describes every widget of the shared contract", () => {
    expect(Object.keys(WIDGET_CATALOG).sort()).toEqual(
      [...DASHBOARD_WIDGET_IDS].sort(),
    );
    expect(ids(ALL_WIDGETS)).toEqual([...DASHBOARD_WIDGET_IDS]);
  });

  it("names and describes each widget in every language", () => {
    for (const locale of ["en", "es", "pt"] as const) {
      const messages = getMessages(locale) as unknown as Record<
        string,
        unknown
      >;
      const lookup = (key: string) =>
        key
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)?.[part],
            messages,
          );
      for (const meta of ALL_WIDGETS) {
        expect(lookup(meta.nameKey), `${locale} ${meta.nameKey}`).toEqual(
          expect.any(String),
        );
        expect(lookup(meta.descriptionKey)).toEqual(expect.any(String));
      }
    }
  });

  it("full widgets span both desktop columns, half widgets one", () => {
    expect(spanClass("full")).toBe("lg:col-span-2");
    expect(spanClass("half")).toBe("lg:col-span-1");
    // The two widgets that were full-width sections before stay that way.
    expect(WIDGET_CATALOG["quick-prompt"].span).toBe("full");
    expect(WIDGET_CATALOG.favorites.span).toBe("full");
    // "Likes & views" has the size of "Plans for today".
    expect(WIDGET_CATALOG["asset-stats"].span).toBe(
      WIDGET_CATALOG["today-plans"].span,
    );
  });
});

describe("layout operations", () => {
  const base = list(
    ["quick-prompt", true],
    ["favorites", true],
    ["credits", false],
    ["activity", true],
    ["tips", true],
  );

  it("lists the visible widgets in order", () => {
    expect(visibleWidgetIds(base)).toEqual([
      "quick-prompt",
      "favorites",
      "activity",
      "tips",
    ]);
  });

  it("knows the default layout", () => {
    expect(sameWidgets(defaultWidgets(), DEFAULT_DASHBOARD_WIDGETS)).toBe(true);
    expect(ids(defaultWidgets())).toEqual([
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "asset-stats",
      "activity",
      "recommendations",
      "credits",
      "tips",
    ]);
    expect(defaultWidgets().every((w) => w.visible)).toBe(true);
    expect(isDefaultLayout(defaultWidgets())).toBe(true);
    expect(isDefaultLayout(base)).toBe(false);
  });

  it("shows and hides a widget in place, without touching the input", () => {
    const next = setWidgetVisible(base, "credits", true);
    expect(next[2]).toEqual({ id: "credits", visible: true });
    expect(ids(next)).toEqual(ids(base));
    expect(base[2]!.visible).toBe(false);
  });

  it("returns the same list for no-ops", () => {
    expect(setWidgetVisible(base, "credits", false)).toBe(base);
    expect(moveWidget(base, "quick-prompt", -1)).toBe(base);
    expect(moveWidget(base, "tips", 1)).toBe(base);
    expect(reorderVisible(base, visibleWidgetIds(base))).toBe(base);
  });

  it("moves a widget one place up or down", () => {
    expect(ids(moveWidget(base, "activity", -1))).toEqual([
      "quick-prompt",
      "favorites",
      "activity",
      "credits",
      "tips",
    ]);
    expect(ids(moveWidget(base, "quick-prompt", 1))).toEqual([
      "favorites",
      "quick-prompt",
      "credits",
      "activity",
      "tips",
    ]);
  });

  it("reorders the visible widgets and keeps hidden ones in their place", () => {
    const next = reorderVisible(base, [
      "tips",
      "quick-prompt",
      "activity",
      "favorites",
    ]);
    expect(ids(next)).toEqual([
      "tips",
      "quick-prompt",
      "credits",
      "activity",
      "favorites",
    ]);
    expect(next[2]).toEqual({ id: "credits", visible: false });
  });

  it("ignores orders that aren't a permutation of the visible widgets", () => {
    expect(reorderVisible(base, ["tips", "favorites"])).toBe(base);
    expect(
      reorderVisible(base, ["tips", "tips", "activity", "favorites"]),
    ).toBe(base);
    // A hidden widget can't be dragged in.
    expect(
      reorderVisible(base, ["credits", "quick-prompt", "activity", "tips"]),
    ).toBe(base);
  });
});

describe("long press rules", () => {
  it("picks a widget up anywhere but text fields and opted-out elements", () => {
    document.body.innerHTML = `
      <div id="card"><p id="text">Hello</p><button id="btn">Go</button>
        <input id="field" /><textarea id="area"></textarea>
        <div contenteditable="true"><span id="editable">x</span></div>
        <div ${Object.keys(NO_WIDGET_DRAG)[0]}><span id="handle">⋮</span></div>
      </div>`;
    const el = (id: string) => document.getElementById(id);

    expect(canStartWidgetDrag(el("text"))).toBe(true);
    expect(canStartWidgetDrag(el("btn"))).toBe(true);
    expect(canStartWidgetDrag(el("field"))).toBe(false);
    expect(canStartWidgetDrag(el("area"))).toBe(false);
    expect(canStartWidgetDrag(el("editable"))).toBe(false);
    expect(canStartWidgetDrag(el("handle"))).toBe(false);
    expect(canStartWidgetDrag(null)).toBe(true);
  });
});

describe("layout cache", () => {
  beforeEach(() => localStorage.clear());

  it("gives back the owner's layout, normalized", () => {
    writeCachedLayout("u1", list(["tips", false], ["favorites", true]));

    const cached = readCachedLayout("u1")!;
    expect(cached.slice(0, 2)).toEqual(
      list(["tips", false], ["favorites", true]),
    );
    expect(cached).toHaveLength(DASHBOARD_WIDGET_IDS.length);
  });

  it("never returns another user's layout", () => {
    writeCachedLayout("u1", defaultWidgets());
    expect(readCachedLayout("u2")).toBeNull();
  });

  it("survives missing or corrupt storage", () => {
    expect(readCachedLayout("u1")).toBeNull();
    localStorage.setItem("creator_hub.dashboard.layout", "{not json");
    expect(readCachedLayout("u1")).toBeNull();
  });
});
