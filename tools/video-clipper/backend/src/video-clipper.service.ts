import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, type Prisma } from "@creator-hub/database";
import { ProviderRegistry } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { PlatformUsageLogger } from "@creator-hub/analytics";
import { Logger } from "@creator-hub/shared-utils";
import type { AIRequest } from "@creator-hub/shared-types";
import {
  AnalysisParseError,
  buildAnalysisPrompt,
  parseAnalysisResponse,
} from "./analysis-prompt";
import { analysisCost, creditUnitsForFrames } from "./pricing";
import {
  MAX_FRAMES,
  VIDEO_CLIPPER_TOOL_ID,
  type AnalysisLanguage,
  type ClipPlatform,
} from "./video-clipper.constants";
import type {
  AnalysisEstimate,
  VideoAnalysisResult,
  VideoAnalysisSummary,
  VideoKeyframe,
  VideoMetadata,
} from "./video-clipper.types";

const TEXT_TASK = "text-generation";

/** Frames may sit a little past the reported duration (rounding, last frame). */
const TIMESTAMP_TOLERANCE_SEC = 1;

export interface AnalyzeVideoInput {
  userId: string;
  modelId: string;
  video: VideoMetadata;
  frames: VideoKeyframe[];
  platform: ClipPlatform;
  language: AnalysisLanguage;
  context?: string;
  /** Aborted when the client disconnects: nothing is charged or saved. */
  signal?: AbortSignal;
}

export interface AnalyzeVideoOutput {
  analysisId: string;
  result: VideoAnalysisResult;
  creditsCharged: number;
}

export class AnalysisAbortedError extends Error {
  constructor() {
    super("Analysis cancelled");
  }
}

interface ResolvedModel {
  modelId: string;
  displayName: string;
  creditCost: number;
  tier: "FREE" | "PRO";
}

/**
 * AI Video Analyzer & Smart Clipper.
 *
 * The browser keeps the video (object URL) and sends only compressed
 * keyframes + metadata. A vision model (ModelMetadata.supportsVision)
 * returns structured JSON — timestamped highlights, hooks and titles — that
 * is normalised, stored (only the JSON) and charged through CreditService.
 * Clipping/export happens client-side.
 */
@Injectable()
export class VideoClipperService {
  private readonly logger = new Logger("VideoClipperService");

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly credits: CreditService,
    private readonly usage: PlatformUsageLogger,
  ) {}

  /** What an analysis with this model and number of keyframes costs. */
  async estimate(
    userId: string,
    modelId: string,
    frames: number,
  ): Promise<AnalysisEstimate> {
    const model = await this.resolveModel(userId, modelId);
    return {
      modelId: model.modelId,
      modelName: model.displayName,
      modelCost: model.creditCost,
      frames,
      units: creditUnitsForFrames(frames),
      total: analysisCost(model.creditCost, frames),
    };
  }

  async analyze(input: AnalyzeVideoInput): Promise<AnalyzeVideoOutput> {
    const started = Date.now();
    const checkAborted = () => {
      if (input.signal?.aborted) throw new AnalysisAbortedError();
    };
    const frames = this.validateFrames(input.frames, input.video.durationSec);

    const model = await this.resolveModel(input.userId, input.modelId);
    const provider = await this.providers.getProviderForModel(model.modelId);
    if (!provider?.supportsImageInput) {
      throw new BadRequestException("Selected provider is not available");
    }

    const cost = analysisCost(model.creditCost, frames.length);
    if (!(await this.credits.hasEnoughCredits(input.userId, cost))) {
      throw new BadRequestException(
        `Insufficient credits. This analysis requires ${cost} credits.`,
      );
    }

    try {
      const prompt = buildAnalysisPrompt({
        video: input.video,
        frames,
        platform: input.platform,
        language: input.language,
        context: input.context,
      });

      let content: string;
      try {
        const response = await provider.generate({
          taskType: TEXT_TASK,
          // DB-driven model id; `AIModel` is a legacy union of built-in
          // names and providers read `request.model` as a plain string.
          model: model.modelId as AIRequest["model"],
          prompt: prompt.prompt,
          images: prompt.images,
          parameters: {
            systemPrompt: prompt.systemPrompt,
            temperature: 0.4,
            maxTokens: 3000,
          },
          userId: input.userId,
          toolId: VIDEO_CLIPPER_TOOL_ID,
        });
        content = (response.output as { content?: string })?.content ?? "";
      } catch (error) {
        this.logger.error("Vision model call failed", {
          userId: input.userId,
          model: model.modelId,
          error: (error as Error).message,
        });
        throw new BadGatewayException(
          "The AI model couldn't analyze this video. Try again or choose another model.",
        );
      }
      checkAborted();

      let parsed;
      try {
        parsed = parseAnalysisResponse(content, {
          durationSec: input.video.durationSec,
          platform: input.platform,
        });
      } catch (error) {
        if (error instanceof AnalysisParseError) {
          throw new BadRequestException(
            "The model didn't return a valid analysis. Try again or choose another model.",
          );
        }
        throw error;
      }

      const result: VideoAnalysisResult = {
        ...parsed,
        platform: input.platform,
        language: input.language,
        video: {
          fileName: input.video.fileName,
          durationSec: input.video.durationSec,
          width: input.video.width ?? null,
          height: input.video.height ?? null,
        },
        frames: frames.length,
        model: { id: model.modelId, name: model.displayName },
      };

      // Save, then charge (the row is removed if the charge fails).
      const saved = await prisma.videoAnalysis.create({
        data: {
          userId: input.userId,
          modelId: model.modelId,
          fileName: input.video.fileName,
          durationSec: input.video.durationSec,
          frameCount: frames.length,
          result: result as unknown as Prisma.InputJsonValue,
          creditsCharged: cost,
        },
      });
      const charged =
        cost === 0 ||
        (await this.credits.deduct(
          input.userId,
          cost,
          VIDEO_CLIPPER_TOOL_ID,
          `Video analysis: ${input.video.fileName.slice(0, 50)}`,
        ));
      if (!charged) {
        try {
          await prisma.videoAnalysis.delete({ where: { id: saved.id } });
        } catch {
          // Already gone: nothing to undo.
        }
        throw new BadRequestException(
          `Insufficient credits. This analysis requires ${cost} credits.`,
        );
      }

      await this.usage.logUsage({
        userId: input.userId,
        toolId: VIDEO_CLIPPER_TOOL_ID,
        modelId: model.modelId,
        duration: Date.now() - started,
        success: true,
        credits: cost,
        metadata: {
          analysisId: saved.id,
          frames: frames.length,
          durationSec: input.video.durationSec,
          sizeBytes: input.video.sizeBytes ?? null,
          platform: input.platform,
          highlights: result.highlights.length,
        },
      });
      this.logger.info("Video analyzed", {
        userId: input.userId,
        analysisId: saved.id,
        frames: frames.length,
        credits: cost,
      });
      return { analysisId: saved.id, result, creditsCharged: cost };
    } catch (error) {
      await this.usage
        .logUsage({
          userId: input.userId,
          toolId: VIDEO_CLIPPER_TOOL_ID,
          modelId: model.modelId,
          duration: Date.now() - started,
          success: false,
          credits: 0,
          error: (error as Error).message,
        })
        .catch(() => undefined);
      throw error;
    }
  }

  async listAnalyses(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: VideoAnalysisSummary[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const [rows, total] = await Promise.all([
      prisma.videoAnalysis.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.videoAnalysis.count({ where: { userId } }),
    ]);
    return {
      data: rows.map((row) => {
        const result = row.result as unknown as Partial<VideoAnalysisResult>;
        return {
          id: row.id,
          fileName: row.fileName,
          durationSec: row.durationSec,
          frameCount: row.frameCount,
          modelId: row.modelId,
          creditsCharged: row.creditsCharged,
          highlights: result?.highlights?.length ?? 0,
          topTitle: result?.titles?.[0]?.text ?? null,
          createdAt: row.createdAt,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAnalysis(
    userId: string,
    analysisId: string,
  ): Promise<{ id: string; createdAt: Date; result: VideoAnalysisResult }> {
    const row = await prisma.videoAnalysis.findFirst({
      where: { id: analysisId, userId },
    });
    if (!row) throw new NotFoundException("Analysis not found");
    return {
      id: row.id,
      createdAt: row.createdAt,
      result: row.result as unknown as VideoAnalysisResult,
    };
  }

  async deleteAnalysis(userId: string, analysisId: string): Promise<void> {
    const { count } = await prisma.videoAnalysis.deleteMany({
      where: { id: analysisId, userId },
    });
    if (count === 0) throw new NotFoundException("Analysis not found");
  }

  /** Sorted copy; every keyframe inside the video. */
  private validateFrames(
    frames: VideoKeyframe[],
    durationSec: number,
  ): VideoKeyframe[] {
    if (frames.length === 0 || frames.length > MAX_FRAMES) {
      throw new BadRequestException(
        `Send between 1 and ${MAX_FRAMES} keyframes`,
      );
    }
    if (
      frames.some((f) => f.timestamp > durationSec + TIMESTAMP_TOLERANCE_SEC)
    ) {
      throw new BadRequestException(
        "Keyframe timestamps must be within the video duration",
      );
    }
    return [...frames].sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Active vision model; PRO models need a paid plan. */
  private async resolveModel(
    userId: string,
    modelId: string,
  ): Promise<ResolvedModel> {
    const model = await prisma.modelMetadata.findFirst({
      where: {
        modelId,
        isActive: true,
        taskType: TEXT_TASK,
        supportsVision: true,
      },
      select: {
        modelId: true,
        displayName: true,
        creditCost: true,
        tier: true,
      },
    });
    if (!model) {
      throw new BadRequestException(
        "This model can't analyze video frames. Choose a vision model.",
      );
    }
    if (model.tier === "PRO") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      if (!user || user.plan === "FREE") {
        throw new ForbiddenException(
          "This provider is only available on paid plans. Please upgrade.",
        );
      }
    }
    return model;
  }
}
