import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import {
  JwtAuthGuard,
  CurrentUser,
  Public,
  AuthenticatedPlanGuard,
  MinPlan,
} from "@creator-hub/auth";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Response } from "express";
import { SocialService } from "./services/social.service";
import { XOAuthService } from "./services/x-oauth.service";
import { TweetDraftService } from "./services/tweet-draft.service";
import { OAuthEncryptionService } from "./services/oauth-encryption.service";
import { PostPublisherService } from "@creator-hub/x-post-tweet-backend";

@Controller("social")
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class SocialController {
  private pendingOAuthStates = new Map<
    string,
    { userId: string; codeVerifier: string; expiresAt: number }
  >();

  constructor(
    private socialService: SocialService,
    private xOAuthService: XOAuthService,
    private tweetDraftService: TweetDraftService,
    private encryptionService: OAuthEncryptionService,
    private publisherService: PostPublisherService,
  ) {}

  @Get("accounts")
  async getAccounts(@CurrentUser("id") userId: string) {
    const accounts = await this.socialService.getAccountsByUserId(userId);
    return { success: true, data: accounts };
  }

  @Post("x/connect")
  async connectX(@CurrentUser("id") userId: string) {
    const { url, state, codeVerifier } =
      this.xOAuthService.generateAuthorizationUrl();

    this.pendingOAuthStates.set(state, {
      userId,
      codeVerifier,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    setTimeout(
      () => {
        this.pendingOAuthStates.delete(state);
      },
      10 * 60 * 1000,
    );

    return { success: true, data: { authorizationUrl: url, state } };
  }

  @Get("x/callback")
  @Public()
  async handleXCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/settings?error=missing_params`);
    }

    const pendingState = this.pendingOAuthStates.get(state);
    if (!pendingState) {
      return res.redirect(`${frontendUrl}/settings?error=invalid_state`);
    }

    if (Date.now() > pendingState.expiresAt) {
      this.pendingOAuthStates.delete(state);
      return res.redirect(`${frontendUrl}/settings?error=state_expired`);
    }

    try {
      await this.xOAuthService.handleCallback(
        pendingState.userId,
        code,
        pendingState.codeVerifier,
      );

      this.pendingOAuthStates.delete(state);
      return res.redirect(`${frontendUrl}/settings?connected=x`);
    } catch (error) {
      this.pendingOAuthStates.delete(state);
      const message = error instanceof Error ? error.message : "unknown";
      console.error("[X OAuth Callback] Error:", message);
      return res.redirect(
        `${frontendUrl}/settings?error=callback_failed&detail=${encodeURIComponent(message)}`,
      );
    }
  }

  @Delete("accounts/:id")
  async disconnectAccount(
    @CurrentUser("id") userId: string,
    @Param("id") accountId: string,
  ) {
    await this.socialService.deleteAccount(userId, accountId);
    return { success: true, data: null };
  }

  @Post("accounts/:id/refresh")
  async refreshTokens(@Param("id") accountId: string) {
    await this.xOAuthService.refreshTokens(accountId);
    return { success: true, data: null };
  }

  @Post("tweets/draft")
  @UseGuards(AuthenticatedPlanGuard)
  @MinPlan("STARTER")
  async createDraft(
    @CurrentUser("id") userId: string,
    @Body()
    dto: {
      topic: string;
      researchData?: any;
      instructions?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<{ success: boolean; data: any }> {
    if (!dto.topic?.trim()) {
      throw new BadRequestException("Topic is required");
    }

    const draft = await this.tweetDraftService.generateTweet({
      userId,
      topic: dto.topic,
      researchData: dto.researchData,
      instructions: dto.instructions,
      model: dto.model,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
    });

    await this.socialService.logAuditEvent(userId, "TWEET_DRAFT_CREATED", {
      draftId: draft.id,
      topic: dto.topic,
    });

    return { success: true, data: draft };
  }

  @Get("tweets/drafts")
  @UseGuards(AuthenticatedPlanGuard)
  @MinPlan("STARTER")
  async getDrafts(
    @CurrentUser("id") userId: string,
    @Query("status") status?: string,
  ): Promise<{ success: boolean; data: any[] }> {
    const drafts = await this.tweetDraftService.getDrafts(userId, status);
    return { success: true, data: drafts };
  }

  @Get("tweets/drafts/:id")
  @UseGuards(AuthenticatedPlanGuard)
  @MinPlan("STARTER")
  async getDraft(
    @CurrentUser("id") userId: string,
    @Param("id") draftId: string,
  ): Promise<{ success: boolean; data: any }> {
    const draft = await this.tweetDraftService.getDraft(userId, draftId);
    return { success: true, data: draft };
  }

  @Patch("tweets/drafts/:id")
  @UseGuards(AuthenticatedPlanGuard)
  @MinPlan("STARTER")
  async updateDraft(
    @CurrentUser("id") userId: string,
    @Param("id") draftId: string,
    @Body() dto: { content: string },
  ): Promise<{ success: boolean; data: any }> {
    if (!dto.content?.trim()) {
      throw new BadRequestException("Content is required");
    }

    const draft = await this.tweetDraftService.updateDraft(
      userId,
      draftId,
      dto.content,
    );

    return { success: true, data: draft };
  }

  @Delete("tweets/drafts/:id")
  @UseGuards(AuthenticatedPlanGuard)
  @MinPlan("STARTER")
  async deleteDraft(
    @CurrentUser("id") userId: string,
    @Param("id") draftId: string,
  ) {
    await this.tweetDraftService.deleteDraft(userId, draftId);
    return { success: true, data: null };
  }

  @Post("tweets/drafts/:id/publish")
  @UseGuards(AuthenticatedPlanGuard)
  @MinPlan("STARTER")
  async publishDraft(
    @CurrentUser("id") userId: string,
    @Param("id") draftId: string,
  ): Promise<{ success: boolean; data: any }> {
    const account = await this.socialService.getActiveAccountByProvider(
      userId,
      "X_TWITTER",
    );

    if (!account) {
      throw new BadRequestException(
        "No active X account connected. Please connect your account in Settings.",
      );
    }

    const accessToken = this.encryptionService.decrypt(account.accessToken);

    const result = await this.publisherService.publishDraft({
      userId,
      draftId,
      accessToken,
    });

    await this.socialService.logAuditEvent(userId, "TWEET_PUBLISHED", {
      draftId,
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
    });

    await this.socialService.updateLastUsed(account.id);

    return { success: true, data: result };
  }
}
