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
