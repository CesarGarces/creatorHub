import { isAxiosError } from "axios";
import {
  CREDIT_STATE_BALANCE,
  type CreditState,
} from "@creator-hub/shared-types";
import { useI18n } from "@/i18n/i18n-provider";

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

/** Localized label for a credit state ("50 credits", "0 credits (out of credits)"). */
export function useCreditStateLabel() {
  const { t } = useI18n();
  return (state: CreditState): string =>
    state === "CREDIT_DEPLETED"
      ? t("creditEmails.depleted")
      : t("common.credits", { count: CREDIT_STATE_BALANCE[state] });
}

/** Message from a NestJS error response (validation errors come as an array). */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message: unknown = isAxiosError(error)
    ? error.response?.data?.message
    : undefined;
  if (Array.isArray(message)) return message.join(", ");
  return typeof message === "string" && message ? message : fallback;
}
