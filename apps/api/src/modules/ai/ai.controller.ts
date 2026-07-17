import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@creator-hub/auth";
import { AIService } from "./ai.service";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(private readonly aiService: AIService) {}

  /**
   * Legacy endpoint — returns providers with modes.
   * Kept for backward compatibility.
   */
  @Get("providers")
  async getProviders() {
    return this.aiService.getActiveProviders();
  }

  /**
   * Returns active models filtered by taskType(s).
   * Used by ProviderSelect to show only models matching the tool's modes.
   *
   * Query params:
   *   taskTypes — comma-separated list (e.g. "image-generation,text-generation")
   */
  @Get("models")
  async getModels(@Query("taskTypes") taskTypes?: string) {
    return this.aiService.getActiveModels(taskTypes);
  }
}
