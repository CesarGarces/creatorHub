import { Injectable, Logger } from "@nestjs/common";
import { EmailProvider } from "./email-provider.interface";
import { renderTemplate } from "./templates/template.helper";
import type {
  VerificationEmailData,
  PasswordResetEmailData,
  PurchaseSuccessEmailData,
  PurchaseFailedEmailData,
} from "./interfaces/email.types";

@Injectable()
export class EmailService {
  private logger = new Logger("EmailService");

  constructor(private provider: EmailProvider) {}

  async sendVerificationEmail(
    to: string,
    data: VerificationEmailData,
  ): Promise<{ success: boolean; error?: string }> {
    const html = renderTemplate("verification", {
      code: data.code,
      userName: data.userName,
    });

    const result = await this.provider.send({
      to,
      subject: "Verify your email — Creator Hub",
      html,
    });

    if (!result.success) {
      this.logger.error(`Verification email failed for ${to}`, {
        error: result.error,
      });
    }

    return { success: result.success, error: result.error };
  }

  async sendPasswordResetEmail(
    to: string,
    data: PasswordResetEmailData,
  ): Promise<{ success: boolean; error?: string }> {
    const html = renderTemplate("password-reset", {
      resetUrl: data.resetUrl,
      userName: data.userName,
    });

    const result = await this.provider.send({
      to,
      subject: "Reset your password — Creator Hub",
      html,
    });

    if (!result.success) {
      this.logger.error(`Password reset email failed for ${to}`, {
        error: result.error,
      });
    }

    return { success: result.success, error: result.error };
  }

  async sendPurchaseSuccessEmail(
    to: string,
    data: PurchaseSuccessEmailData,
  ): Promise<{ success: boolean; error?: string }> {
    const html = renderTemplate("purchase-success", {
      userName: data.userName,
      credits: data.credits,
      planName: data.planName,
      amount: data.amount,
      currency: data.currency,
      balance: data.balance,
      activeTools: data.activeTools,
    });

    const result = await this.provider.send({
      to,
      subject: "Thank you for your purchase — Creator Hub",
      html,
    });

    if (!result.success) {
      this.logger.error(`Purchase success email failed for ${to}`, {
        error: result.error,
      });
    }

    return { success: result.success, error: result.error };
  }

  async sendPurchaseFailedEmail(
    to: string,
    data: PurchaseFailedEmailData,
  ): Promise<{ success: boolean; error?: string }> {
    const html = renderTemplate("purchase-failed", {
      userName: data.userName,
      reason: data.reason,
      retryUrl: data.retryUrl,
    });

    const result = await this.provider.send({
      to,
      subject: "Payment could not be processed — Creator Hub",
      html,
    });

    if (!result.success) {
      this.logger.error(`Purchase failed email failed for ${to}`, {
        error: result.error,
      });
    }

    return { success: result.success, error: result.error };
  }
}
