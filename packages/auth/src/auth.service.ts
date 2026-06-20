import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { prisma } from "@creator-hub/database";
import * as bcrypt from "bcryptjs";
import type { JwtPayload } from "./interfaces/jwt-payload.interface";
import { StorageService } from "@creator-hub/storage";

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private storageService: StorageService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        plan: "FREE",
        currentCredits: 100,
        purchasedCredits: 0,
      },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: "free",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: "ACTIVE",
      },
    });

    return this.generateTokens(user);
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new BadRequestException("No password set for this account");
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    if (newPassword.length < 8) {
      throw new BadRequestException(
        "New password must be at least 8 characters",
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: "Password updated successfully" };
  }

  async updateProfile(userId: string, name: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { name },
    });
    return { message: "Profile updated successfully" };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        currentCredits: true,
        purchasedCredits: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    const generatedImages = await prisma.generatedImage.findMany({
      where: { userId },
      select: { url: true, storageProvider: true },
    });

    const bucket = this.storageService.getDefaultBucket();
    const deletePromises: Promise<void>[] = [];

    for (const image of generatedImages) {
      const key = this.extractKeyFromUrl(image.url, bucket);
      if (key) {
        deletePromises.push(
          this.storageService.delete(key, bucket).catch((error: unknown) => {
            console.warn(`Failed to delete image ${key}:`, error);
          }),
        );
      }
    }

    if (user.avatarUrl && !user.avatarUrl.startsWith("http")) {
      const avatarKey = this.extractKeyFromUrl(user.avatarUrl, bucket);
      if (avatarKey) {
        deletePromises.push(
          this.storageService
            .delete(avatarKey, bucket)
            .catch((error: unknown) => {
              console.warn(`Failed to delete avatar ${avatarKey}:`, error);
            }),
        );
      }
    }

    await Promise.all(deletePromises);

    await prisma.user.delete({ where: { id: userId } });

    return { message: "Account deleted successfully" };
  }

  private extractKeyFromUrl(url: string, bucket: string): string | null {
    if (url.startsWith("http")) {
      try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split("/").filter(Boolean);
        if (pathParts.length >= 2) {
          return pathParts.slice(1).join("/");
        }
      } catch {
        return null;
      }
    }

    if (url.startsWith(`${bucket}/`)) {
      return url.slice(bucket.length + 1);
    }

    return null;
  }

  async validateOAuth(
    provider: string,
    providerAccountId: string,
    email: string,
    name?: string,
  ) {
    const account = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });

    if (account) return this.generateTokens(account.user);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          plan: "FREE",
          currentCredits: 100,
          purchasedCredits: 0,
          accounts: {
            create: { provider, providerAccountId },
          },
        },
      });

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: "free",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          status: "ACTIVE",
        },
      });
    } else {
      await prisma.account.create({
        data: { userId: user.id, provider, providerAccountId },
      });
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: {
    id: string;
    email: string;
    role: string;
    name?: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: "30d" }),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name || null,
      },
    };
  }
}
