import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { EmailProvider } from "../../email-provider.interface";
import type {
  SendEmailOptions,
  EmailResult,
} from "../../interfaces/email.types";
import type { ResendConfig } from "./resend.config";

@Injectable()
export class ResendProvider extends EmailProvider {
  private logger = new Logger("ResendProvider");
  private client: Resend;
  private fromEmail: string;

  constructor(config: ResendConfig) {
    super();
    this.client = new Resend(config.apiKey);
    this.fromEmail = config.fromEmail;
  }

  async send(options: SendEmailOptions): Promise<EmailResult> {
    try {
      const result = await this.client.emails.send({
        from: this.fromEmail,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      });

      this.logger.log(`Email sent to ${options.to}`, { id: result.data?.id });

      return {
        id: result.data?.id || "unknown",
        success: true,
      };
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, {
        error: (error as Error).message,
      });

      return {
        id: "",
        success: false,
        error: (error as Error).message,
      };
    }
  }
}
