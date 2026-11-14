import { getCrossedCreditStates, getCreditStateReached } from "../credit-state";

describe("credit states", () => {
  describe("getCreditStateReached", () => {
    it("enters CREDIT_THRESHOLD_50 when the balance lands exactly on 50", () => {
      expect(getCreditStateReached(55, 50)).toBe("CREDIT_THRESHOLD_50");
    });

    it("enters CREDIT_THRESHOLD_50 when a debit jumps over 50", () => {
      // The old exact-match check (=== 50) missed this case.
      expect(getCreditStateReached(52, 49)).toBe("CREDIT_THRESHOLD_50");
    });

    it("enters CREDIT_DEPLETED when the balance reaches 0", () => {
      expect(getCreditStateReached(5, 0)).toBe("CREDIT_DEPLETED");
      expect(getCreditStateReached(30, 0)).toBe("CREDIT_DEPLETED");
    });

    it("keeps the existing thresholds (75, 25, 10, 5)", () => {
      expect(getCreditStateReached(80, 75)).toBe("CREDIT_THRESHOLD_75");
      expect(getCreditStateReached(26, 25)).toBe("CREDIT_THRESHOLD_25");
      expect(getCreditStateReached(11, 9)).toBe("CREDIT_THRESHOLD_10");
      expect(getCreditStateReached(6, 5)).toBe("CREDIT_THRESHOLD_5");
    });

    it("returns null when no threshold is crossed", () => {
      expect(getCreditStateReached(100, 90)).toBeNull(); // above 75
      expect(getCreditStateReached(50, 45)).toBeNull(); // already at/below 50
      expect(getCreditStateReached(40, 30)).toBeNull(); // between 50 and 25
      expect(getCreditStateReached(0, 0)).toBeNull(); // already depleted
      expect(getCreditStateReached(10, 60)).toBeNull(); // top-up
    });
  });

  describe("getCrossedCreditStates", () => {
    it("lists every crossed state from most to least severe", () => {
      expect(getCrossedCreditStates(60, 20)).toEqual([
        "CREDIT_THRESHOLD_25",
        "CREDIT_THRESHOLD_50",
      ]);
      expect(getCrossedCreditStates(30, 0)).toEqual([
        "CREDIT_DEPLETED",
        "CREDIT_THRESHOLD_5",
        "CREDIT_THRESHOLD_10",
        "CREDIT_THRESHOLD_25",
      ]);
    });

    it("is empty when nothing is crossed", () => {
      expect(getCrossedCreditStates(49, 30)).toEqual([]);
    });
  });
});
