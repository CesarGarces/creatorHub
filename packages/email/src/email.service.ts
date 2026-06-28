import { Injectable, Logger } from "@nestjs/common";
import { EmailProvider } from "./email-provider.interface";
import { renderTemplate } from "./templates/template.helper";
import type { VerificationEmailData } from "./interfaces/email.types";

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
}
