import { Module } from "@nestjs/common";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { XPostTweetModule } from "@creator-hub/x-post-tweet-backend";
import { UserStyleModule } from "../user-style/user-style.module";
import { SocialController } from "./social.controller";
import { SocialService } from "./services/social.service";
import { XOAuthService } from "./services/x-oauth.service";
import { OAuthEncryptionService } from "./services/oauth-encryption.service";
import { TweetDraftService } from "./services/tweet-draft.service";

@Module({
  imports: [AIEngineModule, BillingModule, UserStyleModule, XPostTweetModule],
  controllers: [SocialController],
  providers: [
    SocialService,
    XOAuthService,
    OAuthEncryptionService,
    TweetDraftService,
  ],
  exports: [SocialService, OAuthEncryptionService, TweetDraftService],
})
export class SocialModule {}
