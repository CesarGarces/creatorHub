import { CREDIT_THRESHOLDS, type CreditState } from "@creator-hub/shared-types";

/**
 * Credit states entered when the balance goes from `previousCredits` to
 * `currentCredits`, ordered from the MOST severe to the least severe.
 *
 * A threshold is crossed when the balance moves from above it to at/below it
 * (ARCHITECTURE.md §8: "Events emitted when credit thresholds are crossed").
 * Checking for a crossing instead of an exact match means a 3-credit debit
 * from 52 to 49 still enters CREDIT_THRESHOLD_50.
 *
 *   getCrossedCreditStates(60, 45)  → ["CREDIT_THRESHOLD_50"]
 *   getCrossedCreditStates(30, 0)   → ["CREDIT_DEPLETED", "CREDIT_THRESHOLD_5",
 *                                      "CREDIT_THRESHOLD_10", "CREDIT_THRESHOLD_25"]
 *   getCrossedCreditStates(40, 30)  → []
 */
export function getCrossedCreditStates(
  previousCredits: number,
  currentCredits: number,
): CreditState[] {
  const crossed: CreditState[] = [];
  if (previousCredits > 0 && currentCredits <= 0)
    crossed.push("CREDIT_DEPLETED");

  for (const threshold of [...CREDIT_THRESHOLDS].sort((a, b) => a - b)) {
    if (previousCredits > threshold && currentCredits <= threshold) {
      crossed.push(`CREDIT_THRESHOLD_${threshold}`);
    }
  }
  return crossed;
}

/** The single (most severe) state entered by a balance change, or null. */
export function getCreditStateReached(
  previousCredits: number,
  currentCredits: number,
): CreditState | null {
  return getCrossedCreditStates(previousCredits, currentCredits)[0] ?? null;
}
