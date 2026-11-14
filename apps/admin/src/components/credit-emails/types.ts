import { isAxiosError } from "axios";
import {
  CREDIT_STATE_BALANCE,
  type CreditState,
} from "@creator-hub/shared-types";

export interface CreditEmailTrigger {
  id: string;
  state: CreditState;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditEmailLog {
  id: string;
  userId: string;
  state: CreditState;
  credits: number;
  email: string;
  subject: string;
  status: "PENDING" | "SENT" | "FAILED";
  error: string | null;
  isTest: boolean;
  createdAt: string;
}

export interface CreditEmailInput {
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
}

export function creditStateLabel(state: CreditState): string {
  return state === "CREDIT_DEPLETED"
    ? "0 credits (out of credits)"
    : `${CREDIT_STATE_BALANCE[state]} credits`;
}

/** Message from a NestJS error response (validation errors come as an array). */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message: unknown = isAxiosError(error)
    ? error.response?.data?.message
    : undefined;
  if (Array.isArray(message)) return message.join(", ");
  return typeof message === "string" && message ? message : fallback;
}
