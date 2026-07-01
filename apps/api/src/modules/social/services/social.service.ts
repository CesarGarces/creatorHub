import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { prisma, type SocialAccount } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";

interface UpsertAccountData {
  userId: string;
  provider: string;
  providerUserId: string;
  providerUsername?: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date;
  scopes?: string[];
  status?: string;
}

interface UpdateTokensData {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date;
  status?: string;
}

@Injectable()
export class SocialService {
  private logger = new Logger("SocialService");

  async getAccountsByUserId(userId: string) {
    return prisma.socialAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        providerUsername: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async getAccountById(accountId: string): Promise<SocialAccount | null> {
    return prisma.socialAccount.findUnique({
      where: { id: accountId },
    });
  }

  async getAccountByProvider(
    userId: string,
    provider: string,
  ): Promise<SocialAccount | null> {
    return prisma.socialAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: provider as any,
        },
      },
    });
  }

  async getActiveAccountByProvider(
    userId: string,
    provider: string,
  ): Promise<SocialAccount | null> {
    const account = await this.getAccountByProvider(userId, provider);

    if (!account) {
      return null;
    }

    if (account.status !== "ACTIVE") {
      throw new BadRequestException(
        `Your ${provider} account is ${account.status.toLowerCase()}. Please reconnect your account in Settings.`,
      );
    }

    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      this.logger.warn("Token expired", {
        userId,
        provider,
        accountId: account.id,
      });
      throw new BadRequestException(
        `Your ${provider} token has expired. Please reconnect your account in Settings.`,
      );
    }

    return account;
  }

  async upsertAccount(data: UpsertAccountData): Promise<SocialAccount> {
    return prisma.socialAccount.upsert({
      where: {
        userId_provider: {
          userId: data.userId,
          provider: data.provider as any,
        },
      },
      update: {
        providerUserId: data.providerUserId,
        providerUsername: data.providerUsername,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes || [],
        status: (data.status as any) || "ACTIVE",
        lastUsedAt: new Date(),
      },
      create: {
        userId: data.userId,
        provider: data.provider as any,
        providerUserId: data.providerUserId,
        providerUsername: data.providerUsername,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes || [],
        status: (data.status as any) || "ACTIVE",
      },
    });
  }

  async updateAccountStatus(
    accountId: string,
    status: string,
  ): Promise<SocialAccount> {
    return prisma.socialAccount.update({
      where: { id: accountId },
      data: { status: status as any },
    });
  }

  async updateAccountTokens(
    accountId: string,
    data: UpdateTokensData,
  ): Promise<SocialAccount> {
    return prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        status: (data.status as any) || "ACTIVE",
        lastUsedAt: new Date(),
      },
    });
  }

  async deleteAccount(userId: string, accountId: string) {
    const account = await prisma.socialAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundException("Account not found");
    }

    await prisma.socialAccount.delete({
      where: { id: accountId },
    });

    this.logger.info("Social account deleted", {
      userId,
      accountId,
      provider: account.provider,
    });
  }

  async updateLastUsed(accountId: string): Promise<SocialAccount> {
    return prisma.socialAccount.update({
      where: { id: accountId },
      data: { lastUsedAt: new Date() },
    });
  }

  async logAuditEvent(
    userId: string,
    action: string,
    metadata?: Record<string, any>,
  ) {
    await prisma.socialAccount.updateMany({
      where: { userId },
      data: { lastUsedAt: new Date() },
    });

    this.logger.info(`[AUDIT] ${action}`, { userId, ...metadata });
  }
}
