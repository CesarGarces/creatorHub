import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
import type { ContentAiPlan } from "@creator-hub/database";
// Rate limiting is applied globally (APP_GUARD ThrottlerGuard in AppModule).
import { AiPlannerService, PlanningAbortedError } from "./ai-planner.service";
import { AnalyzePlanDto, EstimatePlanQueryDto } from "./analyze-plan.dto";
import { FILE_LIMITS, type UploadedPlanFile } from "./document-extractor";

/** Minimal response surface used for Server-Sent Events. */
interface SseResponse {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): void;
  end(): void;
  on(event: "close", listener: () => void): void;
  writableEnded?: boolean;
}

@Controller("tools/content-planner/ai-plans")
@UseGuards(JwtAuthGuard)
export class AiPlannerController {
  constructor(private readonly planner: AiPlannerService) {}

  /** What a run will cost with this model (shown before analysing). */
  @Get("estimate")
  async estimate(
    @CurrentUser("id") userId: string,
    @Query() query: EstimatePlanQueryDto,
  ) {
    const estimate = await this.planner.estimate(userId, query.model);
    return { success: true, data: estimate };
  }

  /** Which platform tools a plan can suggest. */
  @Get("tools")
  tools() {
    return { success: true, data: this.planner.availableTools() };
  }

  /**
   * Analyse an idea (text + voice transcript + up to 5 PDF/DOCX/TXT/JSON/MD
   * files) and stream progress as SSE: {type:"stage"} … {type:"done"} or
   * {type:"error"}. Validation errors are plain HTTP errors before streaming.
   */
  @Post()
  @UseInterceptors(
    FilesInterceptor("files", FILE_LIMITS.maxFiles, {
      limits: { fileSize: FILE_LIMITS.maxBytes, files: FILE_LIMITS.maxFiles },
    }),
  )
  async analyze(
    @CurrentUser("id") userId: string,
    @Body() dto: AnalyzePlanDto,
    @UploadedFiles() files: UploadedPlanFile[] | undefined,
    @Res() res: SseResponse,
  ): Promise<void> {
    const abort = new AbortController();
    const send = (data: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.on("close", () => abort.abort());

    try {
      await this.planner.analyze({
        userId,
        modelId: dto.model,
        idea: dto.idea,
        transcript: dto.transcript,
        platform: dto.platform,
        publishDate: dto.publishDate,
        language: dto.language ?? "en",
        files: files ?? [],
        signal: abort.signal,
        onEvent: send,
      });
    } catch (error) {
      if (!(error instanceof PlanningAbortedError)) {
        const status =
          (error as { getStatus?: () => number }).getStatus?.() ?? 500;
        send({
          type: "error",
          status,
          error:
            status >= 500
              ? "Planning failed. Please try again."
              : (error as Error).message,
        });
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  @Get(":planId")
  async getPlan(
    @CurrentUser("id") userId: string,
    @Param("planId") planId: string,
  ): Promise<{ success: true; data: ContentAiPlan }> {
    const plan = await this.planner.getPlan(userId, planId);
    return { success: true, data: plan };
  }
}
