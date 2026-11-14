export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: CreditTransactionType;
  toolId?: string;
  provider?: string;
  description: string;
  createdAt: Date;
}

export type CreditTransactionType =
  | "purchase"
  | "usage"
  | "refund"
  | "bonus"
  | "subscription"
  | "promotion";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  creditsPerMonth: number;
  features: string[];
  tools: string[];
}

/**
 * Credit states (see ARCHITECTURE.md §8 "Marketing Events").
 *
 * A user enters a state when their `currentCredits` crosses one of these
 * thresholds downward. Each state maps 1:1 to a `MarketingEventType` value in
 * the Prisma schema — adding a threshold here requires adding the enum value.
 */
export const CREDIT_THRESHOLDS = [75, 50, 25, 10, 5] as const;

export type CreditThreshold = (typeof CREDIT_THRESHOLDS)[number];

export type CreditState =
  | `CREDIT_THRESHOLD_${CreditThreshold}`
  | "CREDIT_DEPLETED";

/** All credit states, from the least to the most severe. */
export const CREDIT_STATES: readonly CreditState[] = [
  ...CREDIT_THRESHOLDS.map((t) => `CREDIT_THRESHOLD_${t}` as const),
  "CREDIT_DEPLETED",
];

/** Balance (in credits) at which each state is entered. */
export const CREDIT_STATE_BALANCE: Readonly<Record<CreditState, number>> = {
  CREDIT_THRESHOLD_75: 75,
  CREDIT_THRESHOLD_50: 50,
  CREDIT_THRESHOLD_25: 25,
  CREDIT_THRESHOLD_10: 10,
  CREDIT_THRESHOLD_5: 5,
  CREDIT_DEPLETED: 0,
};

export function isCreditState(value: unknown): value is CreditState {
  return (
    typeof value === "string" &&
    (CREDIT_STATES as readonly string[]).includes(value)
  );
}

/** Payload of the Redis domain event published after a credit state is recorded. */
export interface CreditStateReachedEvent {
  userId: string;
  state: CreditState;
  /** Balance after the deduction that caused the state (null when unknown). */
  creditsRemaining: number | null;
  /** Balance before the deduction (null when the state came from a rejected debit). */
  previousCredits: number | null;
  marketingEventId: string;
  timestamp: Date;
}

/** Redis channel for {@link CreditStateReachedEvent}. */
export const CREDIT_STATE_REACHED_CHANNEL = "credit.state_reached";
