import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Inject } from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { StorageService } from "@creator-hub/storage";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import {
  DomainEventPublisher,
  DOMAIN_EVENT_PUBLISHER,
} from "@creator-hub/domain-events";
import type { ThumbnailCompletedEvent, ThumbnailFailedEvent } from "@creator-hub/shared-types";

const THUMBNAIL_COMPLETED_CHANNEL = "thumbnail:completed";
const THUMBNAIL_FAILED_CHANNEL = "thumbnail:failed";

@Processor("thumbnail-generation")
export class ThumbnailProcessor extends WorkerHost {
  private logger = new Logger("ThumbnailProcessor");

  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
    private storageService: StorageService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private eventPublisher: DomainEventPublisher
  ) {
    super();
  }

  async process(
    job: Job<{
      userId: string;
      prompt: string;
      negativePrompt?: string;
      style?: string;
      provider?: string;
      width: number;
      height: number;
      creditCost: number;
    }>
  ): Promise<{ userId: string; key: string; bucket: string; imageId: string }> {
    const { userId, prompt, negativePrompt, style, provider, width, height, creditCost } =
      job.data;

    this.logger.info(`Processing thumbnail job ${job.id}`, { userId, prompt: prompt.slice(0, 50) });

    const fullPrompt = style ? `${prompt}, ${style}` : prompt;
    const startTime = Date.now();

    let result;
    try {
      result = await this.aiEngine.generateImage(fullPrompt, {
        provider: provider as any,
        negativePrompt,
        width,
        height,
        userId,
        toolId: "thumbnail-generator",
      });
    } catch (error) {
      const msg = (error as Error).message || "Unknown AI error";
      this.logger.error(`AI generation failed for job ${job.id}`, {
        error: msg,
        provider,
      });
      throw new Error(`AI provider error: ${msg}`);
    }

    const output = result.output as { type: string; url: string };
    if (!output?.url) {
      throw new Error("AI provider returned no image URL");
    }

    let buffer: Buffer;
    let ext = "png";
    let mimeType = "image/png";

    if (output.url.startsWith("data:image")) {
      const base64Data = output.url.split(",")[1];
      if (!base64Data) {
        throw new Error("Invalid base64 image data");
      }
      buffer = Buffer.from(base64Data, "base64");
    } else if (output.url.startsWith("http")) {
      const response = await fetch(output.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from provider: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get("content-type") || "image/png";
      mimeType = contentType;
      ext = contentType.includes("jpeg") ? "jpg" : "png";
    } else {
      throw new Error(`Unsupported image URL format: ${output.url}`);
    }

    const bucket = this.storageService.getDefaultBucket();
    const key = `${userId}/${Date.now()}-thumbnail.${ext}`;

    let uploadResult;
    try {
      uploadResult = await this.storageService.uploadBuffer(bucket, key, buffer, mimeType);
    } catch (error) {
      const msg = (error as Error).message || "Unknown storage error";
      this.logger.error(`R2 upload failed for job ${job.id}`, {
        error: msg,
        bucket,
        key,
      });
      throw new Error(`Storage upload failed: ${msg}`);
    }

    await this.creditService.deduct(
      userId,
      creditCost,
      "thumbnail-generator",
      `Generated thumbnail: ${prompt.slice(0, 50)}...`
    );

    const duration = Date.now() - startTime;

    const image = await prisma.generatedImage.create({
      data: {
        userId,
        prompt,
        negativePrompt,
        provider: result.provider,
        storageProvider: this.storageService.getProvider(),
        model: result.model,
        width,
        height,
        url: `${uploadResult.bucket}/${uploadResult.key}`,
        credits: creditCost,
      },
    });

    this.logger.info(`Thumbnail job ${job.id} completed`, {
      imageId: image.id,
      duration,
      bucket: uploadResult.bucket,
      key: uploadResult.key,
    });

    return {
      userId,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      imageId: image.id,
    };
  }

  @OnWorkerEvent("completed")
  async onCompleted(job: Job, result: { userId: string; key: string; bucket: string; imageId: string }) {
    this.logger.info(`Thumbnail job ${job.id} finished, publishing event`, { userId: result.userId });

    const event: ThumbnailCompletedEvent = {
      userId: result.userId,
      key: result.key,
      bucket: result.bucket,
      imageId: result.imageId,
    };

    await this.eventPublisher.publish(THUMBNAIL_COMPLETED_CHANNEL, event);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, error: Error) {
    const rawMsg = error?.message || "Unknown error";
    let cleanMessage = rawMsg;
    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed?.error?.message) {
        cleanMessage = parsed.error.message;
      } else if (parsed?.message) {
        cleanMessage = parsed.message;
      }
    } catch {
      // not JSON, use as-is
    }

    this.logger.error(`Thumbnail job ${job.id} failed`, { error: cleanMessage });

    const userId = job.data?.userId;
    if (userId) {
      const friendlyMessage = this.getFriendlyError(cleanMessage);
      const event: ThumbnailFailedEvent = {
        userId,
        error: friendlyMessage,
        rawError: cleanMessage,
        jobId: job.id,
      };
      await this.eventPublisher.publish(THUMBNAIL_FAILED_CHANNEL, event);
    }
  }

  private getFriendlyError(errorMessage: string): string {
    const msg = errorMessage.toLowerCase();
    if (
      msg.includes("429") ||
      msg.includes("resource_exhausted") ||
      msg.includes("rate limit") ||
      msg.includes("quota") ||
      msg.includes("credits") ||
      msg.includes("billing") ||
      msg.includes("depleted")
    ) {
      return "AI is taking a break. The provider is taking longer than usual to process the details. Don't worry, your credits are safe. Shall we try again?";
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return "The request took too long. The provider might be busy. Your credits are safe. Shall we try again?";
    }
    if (msg.includes("insufficient credits")) {
      return "You don't have enough credits. Buy more to keep generating.";
    }
    return "Something went wrong. Don't worry, your credits are safe. Shall we try again?";
  }
}
