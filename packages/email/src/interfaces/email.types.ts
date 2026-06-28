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
