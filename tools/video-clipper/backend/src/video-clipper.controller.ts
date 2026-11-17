import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
// Rate limiting is applied globally (APP_GUARD ThrottlerGuard in AppModule).
import {
  AnalyzeVideoDto,
  EstimateAnalysisQueryDto,
  ListAnalysesQueryDto,
} from "./dto/analyze-video.dto";
import {
  AnalysisAbortedError,
  VideoClipperService,
} from "./video-clipper.service";
import {
  CLIP_LENGTH_RULES,
  HEAVY_FILES_ROADMAP_BYTES,
  MAX_FRAMES,
  MAX_VIDEO_BYTES,
} from "./video-clipper.constants";

/** Minimal response surface: detect clients that leave before the reply. */
interface ClosableResponse {
  on(event: "close", listener: () => void): void;
  writableFinished?: boolean;
}

/** HTTP 499 (client closed request): nothing was charged. */
class ClientClosedRequestException extends HttpException {
  constructor() {
    super("Analysis cancelled", 499);
  }
}

@Controller("tools/video-clipper")
@UseGuards(JwtAuthGuard)
export class VideoClipperController {
  constructor(private readonly clipper: VideoClipperService) {}

  /** Upload limits, platforms and the roadmap of the browser pipeline. */
  @Get("limits")
  limits() {
    return {
      success: true,
      data: {
        maxVideoBytes: MAX_VIDEO_BYTES,
        maxFrames: MAX_FRAMES,
        platforms: CLIP_LENGTH_RULES,
        roadmap: { heavyFilesMaxBytes: HEAVY_FILES_ROADMAP_BYTES },
      },
    };
  }

  /** What an analysis will cost with this model and number of keyframes. */
  @Get("estimate")
  async estimate(
    @CurrentUser("id") userId: string,
    @Query() query: EstimateAnalysisQueryDto,
  ) {
    const data = await this.clipper.estimate(userId, query.model, query.frames);
    return { success: true, data };
  }

  /**
   * Analyse keyframes sampled in the browser with a vision model and
   * return the structured analysis (highlights, hooks, titles). Charged
   * only on success; a client that disconnects first is not charged.
   */
  @Post("analyses")
  async analyze(
    @CurrentUser("id") userId: string,
    @Body() dto: AnalyzeVideoDto,
    @Res({ passthrough: true }) res: ClosableResponse,
  ) {
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) abort.abort();
    });
    try {
      const data = await this.clipper.analyze({
        userId,
        modelId: dto.model,
        video: dto.video,
        frames: dto.frames,
        platform: dto.platform ?? "youtube-shorts",
        language: dto.language ?? "en",
        context: dto.context,
        signal: abort.signal,
      });
      return { success: true, data };
    } catch (error) {
      if (error instanceof AnalysisAbortedError) {
        throw new ClientClosedRequestException();
      }
      throw error;
    }
  }

  @Get("analyses")
  async list(
    @CurrentUser("id") userId: string,
    @Query() query: ListAnalysesQueryDto,
  ) {
    const result = await this.clipper.listAnalyses(
      userId,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return { success: true, ...result };
  }

  @Get("analyses/:analysisId")
  async get(
    @CurrentUser("id") userId: string,
    @Param("analysisId") analysisId: string,
  ) {
    const data = await this.clipper.getAnalysis(userId, analysisId);
    return { success: true, data };
  }

  @Delete("analyses/:analysisId")
  async remove(
    @CurrentUser("id") userId: string,
    @Param("analysisId") analysisId: string,
  ) {
    await this.clipper.deleteAnalysis(userId, analysisId);
    return { success: true };
  }
}
