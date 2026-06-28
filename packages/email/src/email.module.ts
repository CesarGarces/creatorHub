import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EmailService } from "./email.service";
import { EmailProvider } from "./email-provider.interface";
import { ResendProvider } from "./providers/resend/resend.provider";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: EmailProvider,
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>("RESEND_API_KEY");
        const fromEmail = config.get<string>(
          "RESEND_FROM_EMAIL",
          "noreply@creatorhub.com",
        );

        if (!apiKey) {
          throw new Error("RESEND_API_KEY is required");
        }

        return new ResendProvider({ apiKey, fromEmail });
      },
      inject: [ConfigService],
    },
    EmailService,
  ],
  exports: [EmailService, EmailProvider],
})
export class EmailModule {}
