import { describe, expect, it } from "vitest";
import { findDictionaryIssues } from "@creator-hub/i18n";
import { getMessages, translate } from "../translate";

describe("landing dictionaries", () => {
  it("every language has the same keys, placeholders and tags as English", () => {
    expect(
      findDictionaryIssues({
        en: getMessages("en"),
        es: getMessages("es"),
        pt: getMessages("pt"),
      }),
    ).toEqual([]);
  });

  it("renders localized numbers inside sentences", () => {
    expect(translate("en", "common.credits", { count: 2700 })).toBe(
      "2,700 credits",
    );
    expect(translate("pt", "common.credits", { count: 2700 })).toBe(
      "2.700 créditos",
    );
    expect(
      translate("es", "agents.tryAgent", { agent: "Agente de TikTok" }),
    ).toBe("Probar Agente de TikTok");
  });
});
