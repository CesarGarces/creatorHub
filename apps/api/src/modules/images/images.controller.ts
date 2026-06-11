import {
  Controller,
  Post,
  Body,
  UseGuards,
} from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";

@Controller("images")
@UseGuards(JwtAuthGuard)
export class ImagesController {
  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService
  ) {}

  @Post("generate")
  async generateImage(
    @CurrentUser("id") userId: string,
    @Body() dto: { prompt: string; toolId: string; provider?: string }
  ) {
    const hasCredits = await this.creditService.hasEnoughCredits(userId, 10);
    if (!hasCredits) {
      return { success: false, error: "Insufficient credits" };
    }

    const result = await this.aiEngine.generateImage(dto.prompt, {
      provider: dto.provider as any,
      userId,
      toolId: dto.toolId,
    });

    await this.creditService.deduct(userId, 10, dto.toolId, "Image generation");

    return { success: true, data: result };
  }
}
