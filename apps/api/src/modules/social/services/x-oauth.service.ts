import { Injectable, BadRequestException } from "@nestjs/common";
import { randomBytes, createHash } from "crypto";
import { Logger } from "@creator-hub/shared-utils";
import { OAuthEncryptionService } from "./oauth-encryption.service";
import { SocialService } from "./social.service";

interface XOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface XUserInfo {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

@Injectable()
export class XOAuthService {
  private logger = new Logger("XOAuthService");
  private readonly AUTH_URL = "https://x.com/i/oauth2/authorize";
  private readonly TOKEN_URL = "https://api.x.com/2/oauth2/token";
  private readonly USER_URL = "https://api.x.com/2/users/me";
  private readonly SCOPES = [
    "tweet.read",
    "tweet.write",
    "users.read",
    "offline.access",
  ];

  constructor(
    private encryptionService: OAuthEncryptionService,
    private socialService: SocialService,
  ) {}

  generateAuthorizationUrl(): {
    url: string;
    state: string;
    codeVerifier: string;
  } {
    const clientId = process.env.X_CLIENT_ID;
    const redirectUri = process.env.X_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new BadRequestException("X OAuth credentials not configured");
    }

    const state = randomBytes(32).toString("hex");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: this.SCOPES.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const url = `${this.AUTH_URL}?${params.toString()}`;

    return { url, state, codeVerifier };
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<XOAuthTokens> {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    const redirectUri = process.env.X_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new BadRequestException("X OAuth credentials not configured");
    }

    const params = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (clientSecret) {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      );
      headers["Authorization"] = `Basic ${credentials}`;
    } else {
      params.append("client_id", clientId);
    }

    const response = await fetch(this.TOKEN_URL, {
      method: "POST",
      headers,
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error("Token exchange failed", { error });
      throw new BadRequestException("Failed to exchange code for tokens");
    }

    return (await response.json()) as XOAuthTokens;
  }

  async getUserInfo(accessToken: string): Promise<XUserInfo> {
    const response = await fetch(this.USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error("Failed to fetch user info", { error });
      throw new BadRequestException("Failed to fetch user info from X");
    }

    const data = (await response.json()) as { data: XUserInfo };
    return data.data;
  }

  async handleCallback(
    userId: string,
    code: string,
    codeVerifier: string,
  ): Promise<void> {
    const tokens = await this.exchangeCodeForTokens(code, codeVerifier);
    const userInfo = await this.getUserInfo(tokens.access_token);

    const encryptedAccessToken = this.encryptionService.encrypt(
      tokens.access_token,
    );
    const encryptedRefreshToken = tokens.refresh_token
      ? this.encryptionService.encrypt(tokens.refresh_token)
      : null;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.socialService.upsertAccount({
      userId,
      provider: "X_TWITTER",
      providerUserId: userInfo.id,
      providerUsername: userInfo.username,
      displayName: userInfo.name,
      avatarUrl: userInfo.profile_image_url,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      scopes: this.SCOPES,
      status: "ACTIVE",
    });

    this.logger.info("X account connected", {
      userId,
      username: userInfo.username,
    });
  }

  async refreshTokens(accountId: string): Promise<void> {
    const account = await this.socialService.getAccountById(accountId);
    if (!account || !account.refreshToken) {
      throw new BadRequestException("Account not found or no refresh token");
    }

    const decryptedRefreshToken = this.encryptionService.decrypt(
      account.refreshToken,
    );

    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;

    if (!clientId) {
      throw new BadRequestException("X OAuth credentials not configured");
    }

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptedRefreshToken,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (clientSecret) {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      );
      headers["Authorization"] = `Basic ${credentials}`;
    } else {
      params.append("client_id", clientId);
    }

    const response = await fetch(this.TOKEN_URL, {
      method: "POST",
      headers,
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error("Token refresh failed", { error, accountId });
      await this.socialService.updateAccountStatus(accountId, "EXPIRED");
      throw new BadRequestException("Failed to refresh tokens");
    }

    const tokens = (await response.json()) as XOAuthTokens;

    const encryptedAccessToken = this.encryptionService.encrypt(
      tokens.access_token,
    );
    const encryptedRefreshToken = tokens.refresh_token
      ? this.encryptionService.encrypt(tokens.refresh_token)
      : null;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.socialService.updateAccountTokens(accountId, {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      status: "ACTIVE",
    });

    this.logger.info("Tokens refreshed successfully", { accountId });
  }
}
