import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "@creator-hub/auth";
import { Public, CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
import { EmailService } from "@creator-hub/email";
import { prisma } from "@creator-hub/database";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";
import { IsEmail, IsString, MinLength, Length } from "class-validator";

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  name?: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

class UpdateProfileDto {
  @IsString()
  name!: string;
}

class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

class ResendVerificationDto {
  @IsEmail()
  email!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private emailService: EmailService,
  ) {}

  // 5 registrations/hour per IP: account-creation abuse costs 100 credits each.
  // Idempotency-Key support: safe client retries without duplicate side effects.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    // verificationCode/userName are internal-only: stripped from the response.
    const { verificationCode, userName, ...result } =
      await this.authService.register(dto.email, dto.password, dto.name);

    if (verificationCode) {
      await this.emailService.sendVerificationEmail(dto.email, {
        code: verificationCode,
        userName: userName || undefined,
      });
    }

    return result;
  }

  // 10 logins/minute per IP: slows credential brute force.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // 10 attempts/5min per IP: the 6-digit code (1M combinations) must not be brute-forceable.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.code);
  }

  // 3 resends/5min per IP: verification-email spam protection.
  @Public()
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    const result = await this.authService.resendVerification(dto.email);

    const user = await prisma.user.findUnique({
      where: { email: dto.email },
      select: { verificationCode: true, name: true },
    });

    if (user?.verificationCode) {
      await this.emailService.sendVerificationEmail(dto.email, {
        code: user.verificationCode,
        userName: user.name || undefined,
      });
    }

    return result;
  }

  @Public()
  @Get("verification-status/:email")
  async getVerificationStatus(@Param("email") email: string) {
    return this.authService.getVerificationStatus(email);
  }

  // 3 requests/5min per IP: reset-email spam protection.
  @Public()
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto.email);

    if (result.token) {
      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/reset-password?token=${result.token}`;
      const user = await prisma.user.findUnique({
        where: { email: dto.email },
        select: { name: true },
      });

      await this.emailService.sendPasswordResetEmail(dto.email, {
        resetUrl,
        userName: user?.name || undefined,
      });
    }

    return { message: result.message };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Get("validate-reset-token/:token")
  async validateResetToken(@Param("token") token: string) {
    return this.authService.validateResetToken(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser("id") userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMe(@CurrentUser("id") userId: string) {
    return this.authService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  async updateProfile(
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("account")
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser("id") userId: string) {
    return this.authService.deleteAccount(userId);
  }
}
