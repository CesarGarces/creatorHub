import { describe, expect, it } from "vitest";
import en from "@/content/pro-tips/en.json";
import es from "@/content/pro-tips/es.json";
import pt from "@/content/pro-tips/pt.json";
import {
  PRO_TIP_CATEGORIES,
  loadProTips,
  localHour,
  parseProTips,
  tipIndexForHour,
} from "../pro-tips";

const FILES = { en, es, pt };

describe("pro tips content (src/content/pro-tips)", () => {
  const tips = {
    en: parseProTips(en),
    es: parseProTips(es),
    pt: parseProTips(pt),
  };

  it("has 100 valid tips in every language (nothing dropped by the parser)", () => {
    for (const [locale, file] of Object.entries(FILES)) {
      expect(file.locale, locale).toBe(locale);
      expect(file.tips, locale).toHaveLength(100);
      expect(tips[locale as keyof typeof tips], locale).toHaveLength(100);
    }
  });

  it("has unique, kebab-case ids", () => {
    const ids = tips.en.map((t) => t.id);
    expect(new Set(ids).size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("lists the same tips, in the same order and categories, in every language", () => {
    const shape = (list: typeof tips.en) =>
      list.map((t) => `${t.id}:${t.category}`);
    expect(shape(tips.es)).toEqual(shape(tips.en));
    expect(shape(tips.pt)).toEqual(shape(tips.en));
  });

  it("is really translated", () => {
    const sameAsEnglish = (list: typeof tips.en) =>
      list.filter((t, i) => t.body === tips.en[i]!.body).length;
    expect(sameAsEnglish(tips.es)).toBe(0);
    expect(sameAsEnglish(tips.pt)).toBe(0);
  });

  it("keeps tips short enough for the card", () => {
    for (const list of Object.values(tips)) {
      for (const tip of list) {
        expect(tip.title.length, tip.id).toBeLessThanOrEqual(70);
        expect(tip.body.length, tip.id).toBeLessThanOrEqual(260);
        expect(tip.body.trim(), tip.id).toBe(tip.body);
      }
    }
  });

  it("covers every category, with calendar, widgets and viral videos well represented", () => {
    const count = (category: string) =>
      tips.en.filter((t) => t.category === category).length;
    for (const category of PRO_TIP_CATEGORIES) {
      expect(count(category), category).toBeGreaterThanOrEqual(3);
    }
    expect(count("calendar")).toBeGreaterThanOrEqual(10);
    expect(count("dashboard")).toBeGreaterThanOrEqual(10);
    expect(count("viral")).toBeGreaterThanOrEqual(10);
  });

  it("loads only the requested language", async () => {
    expect((await loadProTips("es"))[0]!.title).toBe(tips.es[0]!.title);
    expect(await loadProTips("pt")).toHaveLength(100);
  });
});

describe("parseProTips", () => {
  it("skips malformed entries and unknown categories", () => {
    expect(
      parseProTips({
        tips: [
          { id: "a", category: "calendar", title: "T", body: "B" },
          { id: "b", category: "weather", title: "T", body: "B" },
          { id: "c", category: "viral", title: " ", body: "B" },
          null,
        ],
      }).map((t) => t.id),
    ).toEqual(["a"]);
    expect(parseProTips(undefined)).toEqual([]);
  });
});

describe("hourly rotation", () => {
  const H = 500_000; // some hour since the epoch

  it("shows the same tip for the whole hour, on every reload", () => {
    expect(tipIndexForHour(H, 100, "u1")).toBe(tipIndexForHour(H, 100, "u1"));
  });

  it("shows every tip once per 100 hours, in a shuffled order", () => {
    const start = H - (H % 100);
    const shown = Array.from({ length: 100 }, (_, i) =>
      tipIndexForHour(start + i, 100, "u1"),
    );
    expect(new Set(shown).size).toBe(100);
    // Random, not 0, 1, 2…
    expect(shown).not.toEqual(Array.from({ length: 100 }, (_, i) => i));
  });

  it("never shows the same tip two hours in a row, even across cycles", () => {
    for (let hour = H; hour < H + 300; hour++) {
      expect(tipIndexForHour(hour + 1, 100, "u1")).not.toBe(
        tipIndexForHour(hour, 100, "u1"),
      );
    }
    // Each boundary has a 1-in-100 chance of a repeat: check thousands.
    let repeats = 0;
    for (let cycle = 0; cycle < 3000; cycle++) {
      const last = cycle * 100 + 99;
      if (
        tipIndexForHour(last, 100, "u1") ===
        tipIndexForHour(last + 1, 100, "u1")
      ) {
        repeats++;
      }
    }
    expect(repeats).toBe(0);
  });

  it("gives each user their own order and each cycle a new one", () => {
    const order = (salt: string, from: number) =>
      Array.from({ length: 100 }, (_, i) =>
        tipIndexForHour(from + i, 100, salt),
      );
    const start = H - (H % 100);
    expect(order("u1", start)).not.toEqual(order("u2", start));
    expect(order("u1", start)).not.toEqual(order("u1", start + 100));
  });

  it("handles tiny lists", () => {
    expect(tipIndexForHour(H, 0)).toBe(-1);
    expect(tipIndexForHour(H, 1)).toBe(0);
    expect(tipIndexForHour(H + 1, 2)).not.toBe(tipIndexForHour(H, 2));
  });

  it("changes on the hour of the user's clock", () => {
    const h = (hour: number, minute: number) =>
      localHour(new Date(2026, 10, 17, hour, minute));
    expect(h(10, 0)).toBe(h(10, 59));
    expect(h(11, 0)).toBe(h(10, 59) + 1);
  });
});
