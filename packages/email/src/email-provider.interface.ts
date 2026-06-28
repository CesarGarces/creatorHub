import type { SendEmailOptions, EmailResult } from "./interfaces/email.types";

export abstract class EmailProvider {
  abstract send(options: SendEmailOptions): Promise<EmailResult>;
}
