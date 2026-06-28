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
} from "@nestjs/common";
import { AuthService } from "@creator-hub/auth";
import { Public, CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
import { EmailService } from "@creator-hub/email";
import { prisma } from "@creator-hub/database";
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

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(
      dto.email,
      dto.password,
      dto.name,
    );

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
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.code);
  }

  @Public()
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

  @Public()
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
