export { EmailModule } from "./email.module";
export { EmailService } from "./email.service";
export { EmailProvider } from "./email-provider.interface";
export {
  CREDIT_EMAIL_VARIABLES,
  interpolateCreditEmailText,
  isSafeEmailUrl,
} from "./credit-state-content";
export type {
  EmailResult,
  SendEmailOptions,
  VerificationEmailData,
  PasswordResetEmailData,
  PurchaseSuccessEmailData,
  PurchaseFailedEmailData,
  CreditStateEmailContent,
  CreditStateEmailVariables,
  RenderedEmail,
} from "./interfaces/email.types";
