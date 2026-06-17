import { Controller, Post, Body, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { prisma } from "@creator-hub/database";
import * as bcrypt from "bcryptjs";

@Controller("admin")
export class AdminAuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Post("login")
  async adminLogin(
    @Body() dto: { email: string; password: string },
  ): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user?.passwordHash || user.role !== "ADMIN") {
      throw new UnauthorizedException("Verify your email and password");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Verify your email and password");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      data: {
        accessToken,
        user: { id: user.id, email: user.email, role: user.role },
      },
    };
  }
}
