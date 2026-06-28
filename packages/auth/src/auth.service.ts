import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { prisma } from "@creator-hub/database";
import * as bcrypt from "bcryptjs";
import type { JwtPayload } from "./interfaces/jwt-payload.interface";
import { StorageService } from "@creator-hub/storage";

@Injectable()
export class AuthService {
  private verificationCooldowns = new Map<string, number>();

  constructor(
    private jwtService: JwtService,
    private storageService: StorageService,
  ) {}

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getVerificationCodeExpiry(): Date {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10);
    return expiry;
  }

  async register(email: string, password: string, name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationCode = this.generateVerificationCode();
    const verificationExpires = this.getVerificationCodeExpiry();

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        plan: "FREE",
        currentCredits: 100,
        purchasedCredits: 0,
        verificationCode,
        verificationExpires,
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

    return {
      ...this.generateTokens(user),
      emailVerified: false,
      requiresVerification: true,
    };
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

    return {
      ...this.generateTokens(user),
      emailVerified: !!user.emailVerified,
      requiresVerification: !user.emailVerified,
    };
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
        emailVerified: true,
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

  async verifyEmail(
    email: string,
    code: string,
  ): Promise<{ message: string; user: Record<string, unknown> }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException("User not found");

    if (user.emailVerified) {
      return {
        message: "Email already verified",
        user: this.sanitizeUser(user),
      };
    }

    if (!user.verificationCode || !user.verificationExpires) {
      throw new BadRequestException(
        "No verification code pending. Please request a new one.",
      );
    }

    if (user.verificationExpires < new Date()) {
      throw new BadRequestException(
        "Verification code has expired. Please request a new one.",
      );
    }

    if (user.verificationCode !== code) {
      throw new BadRequestException("Invalid verification code");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationCode: null,
        verificationExpires: null,
      },
    });

    return {
      message: "Email verified successfully",
      user: this.sanitizeUser(updated),
    };
  }

  async resendVerification(
    email: string,
  ): Promise<{ message: string; cooldownSeconds: number }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException("User not found");

    if (user.emailVerified) {
      throw new BadRequestException("Email is already verified");
    }

    const now = Date.now();
    const lastSent = this.verificationCooldowns.get(email);
    if (lastSent && now - lastSent < 60000) {
      const remaining = Math.ceil((60000 - (now - lastSent)) / 1000);
      throw new BadRequestException(
        `Please wait ${remaining} seconds before requesting a new code`,
      );
    }

    const verificationCode = this.generateVerificationCode();
    const verificationExpires = this.getVerificationCodeExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode, verificationExpires },
    });

    this.verificationCooldowns.set(email, now);

    return {
      message: "Verification code sent",
      cooldownSeconds: 60,
    };
  }

  async getVerificationStatus(
    email: string,
  ): Promise<{ verified: boolean; pending: boolean }> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { emailVerified: true, verificationCode: true },
    });

    if (!user) throw new BadRequestException("User not found");

    return {
      verified: !!user.emailVerified,
      pending: !!user.verificationCode,
    };
  }

  async forgotPassword(
    email: string,
  ): Promise<{ message: string; token?: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: "If an account exists, a reset link was sent." };
    }

    const token = this.generateResetToken();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    return { message: "If an account exists, a reset link was sent.", token };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    if (newPassword.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return { message: "Password reset successfully" };
  }

  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    return { valid: !!user };
  }

  private generateResetToken(): string {
    const array = new Uint8Array(32);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < 32; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    role: string;
    name?: string | null;
    emailVerified?: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || null,
      emailVerified: user.emailVerified,
    };
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
