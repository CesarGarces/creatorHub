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
