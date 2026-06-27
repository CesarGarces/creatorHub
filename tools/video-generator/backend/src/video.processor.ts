import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Inject } from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { StorageService } from "@creator-hub/storage";
import { prisma } from "@creator-hub/database";
import { Logger, getFriendlyError } from "@creator-hub/shared-utils";
import {
  DomainEventPublisher,
  DOMAIN_EVENT_PUBLISHER,
} from "@creator-hub/domain-events";
import type {
  VideoCompletedEvent,
  VideoFailedEvent,
} from "@creator-hub/shared-types";

const VIDEO_COMPLETED_CHANNEL = "video:completed";
const VIDEO_FAILED_CHANNEL = "video:failed";

@Processor("video-generation")
export class VideoProcessor extends WorkerHost {
  private logger = new Logger("VideoProcessor");

  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
    private storageService: StorageService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private eventPublisher: DomainEventPublisher,
  ) {
    super();
  }

  async process(
    job: Job<{
      userId: string;
      prompt: string;
      imageUrl?: string;
      model: string;
      provider: string;
      providerId?: string;
      providerTier?: "FREE" | "PRO";
      creditCost: number;
      width: number;
      height: number;
    }>,
  ): Promise<{
    userId: string;
    key: string;
    bucket: string;
    videoId: string;
  }> {
    const {
      userId,
      prompt,
      imageUrl,
      model,
      provider,
      providerId,
      providerTier,
      creditCost,
      width,
      height,
    } = job.data;

    this.logger.info(`Processing video job ${job.id}`, {
      userId,
      prompt: prompt.slice(0, 50),
    });

    const resolvedImageUrl = imageUrl;
    this.logger.info(`Video processor imageUrl check`, {
      hasImage: !!imageUrl,
      startsWithData: imageUrl?.startsWith("data:image"),
      urlPreview: imageUrl ? imageUrl.slice(0, 80) : null,
    });

    const startTime = Date.now();

    let result;
    try {
      result = await this.aiEngine.execute({
        taskType: "video-generation",
        provider: provider as any,
        model: model as any,
        prompt,
        parameters: { imageUrl: resolvedImageUrl, width, height },
        userId,
        toolId: "video-generator",
      });
    } catch (error) {
      const msg = (error as Error).message || "Unknown AI error";
      this.logger.error(`AI generation failed for video job ${job.id}`, {
        error: msg,
        provider,
      });
      throw new Error(`AI provider error: ${msg}`);
    }

    const output = result.output as { type: string; url: string };
    if (!output?.url) throw new Error("AI provider returned no video URL");

    let buffer: Buffer;
    let mimeType = "video/mp4";

    if (output.url.startsWith("http")) {
      const response = await fetch(output.url);
      if (!response.ok)
        throw new Error(
          `Failed to fetch video from provider: ${response.status}`,
        );
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || "video/mp4";
      mimeType = contentType;
    } else {
      throw new Error(`Unsupported video URL format: ${output.url}`);
    }

    const bucket = this.storageService.getDefaultBucket();
    const key = `${userId}/${Date.now()}-video.mp4`;
    let uploadResult;
    try {
      uploadResult = await this.storageService.uploadBuffer(
        bucket,
        key,
        buffer,
        mimeType,
      );
    } catch (error) {
      const msg = (error as Error).message || "Unknown storage error";
      this.logger.error(`R2 upload failed for video job ${job.id}`, {
        error: msg,
        bucket,
        key,
      });
      throw new Error(`Storage upload failed: ${msg}`);
    }

    await this.creditService.deduct(
      userId,
      creditCost,
      "video-generator",
      `Generated video: ${prompt.slice(0, 50)}...`,
    );

    const duration = Date.now() - startTime;
    const isProModel = providerTier === "PRO";

    const video = await prisma.generatedImage.create({
      data: {
        userId,
        toolId: "video-generator",
        providerId,
        type: "VIDEO",
        prompt,
        provider: result.provider,
        storageProvider: this.storageService.getProvider(),
        model: result.model,
        width,
        height,
        url: `${uploadResult.bucket}/${uploadResult.key}`,
        credits: creditCost,
        isProModel,
      },
    });

    this.logger.info(`Video job ${job.id} completed`, {
      videoId: video.id,
      duration,
    });

    return {
      userId,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      videoId: video.id,
    };
  }

  @OnWorkerEvent("completed")
  async onCompleted(
    job: Job,
    result: { userId: string; key: string; bucket: string; videoId: string },
  ) {
    const event: VideoCompletedEvent = {
      userId: result.userId,
      key: result.key,
      bucket: result.bucket,
      videoId: result.videoId,
    };
    await this.eventPublisher.publish(VIDEO_COMPLETED_CHANNEL, event);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    const rawMsg = error?.message || "Unknown error";
    let cleanMessage = rawMsg;
    try {
      const parsed = JSON.parse(rawMsg);
      cleanMessage = parsed?.error?.message || parsed?.message || rawMsg;
    } catch {}

    const userId = job.data?.userId;
    if (userId) {
      const friendlyMessage = getFriendlyError(cleanMessage);
      const event: VideoFailedEvent = {
        userId,
        error: friendlyMessage,
        rawError: cleanMessage,
        jobId: job.id,
      };
      await this.eventPublisher.publish(VIDEO_FAILED_CHANNEL, event);
    }
  }
}
