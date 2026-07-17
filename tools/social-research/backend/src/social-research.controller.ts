import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { SocialResearchService } from "./social-research.service";

@Controller("tools/social-research")
@UseGuards(JwtAuthGuard)
export class SocialResearchController {
  constructor(private researchService: SocialResearchService) {}

  @Get("sessions/:toolId")
  async getSessions(
    @CurrentUser("id") userId: string,
    @Param("toolId") toolId: string,
  ) {
    return this.researchService.getUserSessions(userId, toolId);
  }

  @Post("sessions/:toolId")
  async createSession(
    @CurrentUser("id") userId: string,
    @Param("toolId") toolId: string,
    @Body() dto: { sessionId?: string; title?: string },
  ) {
    return this.researchService.getOrCreateSession(
      userId,
      toolId,
      dto.sessionId,
      dto.title,
    );
  }

  @Delete("sessions/:sessionId")
  async deleteSession(
    @CurrentUser("id") userId: string,
    @Param("sessionId") sessionId: string,
  ) {
    const deleted = await this.researchService.deleteSession(sessionId, userId);
    if (!deleted) {
      throw new BadRequestException("Session not found");
    }
    return { success: true };
  }

  @Post("sessions/:sessionId/title")
  async updateTitle(
    @CurrentUser("id") userId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: { title: string },
  ) {
    if (!dto.title?.trim()) {
      throw new BadRequestException("Title is required");
    }
    await this.researchService.updateSessionTitle(
      sessionId,
      userId,
      dto.title.trim(),
    );
    return { success: true };
  }

  @Post("cache/check")
  async checkCache(@Body() dto: { query: string; provider: string }) {
    if (!dto.query?.trim() || !dto.provider) {
      throw new BadRequestException("Query and provider are required");
    }
    const cached = await this.researchService.getCachedResult(
      dto.query,
      dto.provider,
    );
    return { cached: !!cached, data: cached };
  }
}
