import { SetMetadata } from "@nestjs/common";
import { SKIP_EMAIL_VERIFICATION_KEY } from "../guards/email-verified.guard";

export const SkipEmailVerification = () =>
  SetMetadata(SKIP_EMAIL_VERIFICATION_KEY, true);
