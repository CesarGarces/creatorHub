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

    // Check if token is expired
    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      this.logger.warn("Social account token expired", {
        userId,
        provider,
        expiresAt: account.tokenExpiresAt,
      });
      // Don't throw here - let the caller handle the API error
    }

    return account;
  }

  async updateLastUsed(accountId: string): Promise<void> {
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { lastUsedAt: new Date() },
    });
  }
}
