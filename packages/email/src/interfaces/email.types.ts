export interface EmailResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface VerificationEmailData {
  code: string;
  userName?: string;
}

export interface PasswordResetEmailData {
  resetUrl: string;
  userName?: string;
}

export interface PurchaseSuccessEmailData {
  userName?: string;
  credits: number;
  planName?: string;
  amount?: number;
  currency?: string;
  balance?: number;
  activeTools?: string[];
}

export interface PurchaseFailedEmailData {
  userName?: string;
  reason?: string;
  retryUrl?: string;
}

/** Admin-editable content of a credit state email (CreditEmailTrigger). */
export interface CreditStateEmailContent {
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

/** Values substituted for {{variables}} in {@link CreditStateEmailContent}. */
export interface CreditStateEmailVariables {
  name: string;
  credits: number;
  threshold: number;
  purchaseUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}
