import { Injectable, BadRequestException } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import { prisma, type SocialAccount } from "@creator-hub/database";

@Injectable()
export class SocialService {
  private logger = new Logger("SocialService");

  async getActiveAccountByProvider(
    userId: string,
    provider: string,
  ): Promise<SocialAccount | null> {
    const account = await prisma.socialAccount.findFirst({
      where: {
        userId,
        provider: provider as any,
        status: "ACTIVE",
      },
    });

    if (!account) {
      throw new BadRequestException(
        `No active ${provider} account connected. Please connect your account in Settings.`,
      );
    }

    // Check if token is expired and try to refresh
    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      this.logger.warn("Token expired, attempting refresh", {
        userId,
        provider,
        expiresAt: account.tokenExpiresAt,
      });

      try {
        await this.refreshAccountToken(account.id);
        // Return fresh account after refresh
        return await prisma.socialAccount.findUnique({
          where: { id: account.id },
        });
      } catch (error) {
        this.logger.error("Token refresh failed", {
          error: (error as Error).message,
          accountId: account.id,
        });
        throw new BadRequestException(
          "Your X account connection has expired. Please disconnect and reconnect your X account in Settings.",
        );
      }
    }

    return account;
  }

  async updateLastUsed(accountId: string): Promise<void> {
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { lastUsedAt: new Date() },
    });
  }

  private async refreshAccountToken(accountId: string): Promise<void> {
    const apiUrl = process.env.API_URL || "http://localhost:3001";
    const response = await fetch(
      `${apiUrl}/api/v1/social/accounts/${accountId}/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Refresh failed: ${error}`);
    }

    this.logger.info("Token refreshed successfully", { accountId });
  }
}
