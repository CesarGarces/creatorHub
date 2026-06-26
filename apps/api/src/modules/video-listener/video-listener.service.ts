import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { StorageService } from "@creator-hub/storage";
import { AppGateway } from "../websocket/websocket.gateway";
import {
  DomainEventSubscriber,
  DOMAIN_EVENT_SUBSCRIBER,
} from "@creator-hub/domain-events";
import type {
  VideoCompletedEvent,
  VideoFailedEvent,
  VideoReadyPayload,
  ToolJobUpdatePayload,
} from "@creator-hub/shared-types";

const VIDEO_COMPLETED_CHANNEL = "video:completed";
const VIDEO_FAILED_CHANNEL = "video:failed";

@Injectable()
export class VideoListenerService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger("VideoListenerService");

  constructor(
    @Inject(DOMAIN_EVENT_SUBSCRIBER)
    private eventSubscriber: DomainEventSubscriber,
    private storageService: StorageService,
    private gateway: AppGateway,
  ) {}

  async onModuleInit() {
    await this.eventSubscriber.subscribe<VideoCompletedEvent>(
      VIDEO_COMPLETED_CHANNEL,
      this.handleCompleted.bind(this),
    );

    await this.eventSubscriber.subscribe<VideoFailedEvent>(
      VIDEO_FAILED_CHANNEL,
      this.handleFailed.bind(this),
    );

    this.logger.log("Subscribed to video events");
  }

  async onModuleDestroy() {
    await this.eventSubscriber.unsubscribe(VIDEO_COMPLETED_CHANNEL);
    await this.eventSubscriber.unsubscribe(VIDEO_FAILED_CHANNEL);
    this.logger.log("Unsubscribed from video events");
  }

  private async handleCompleted(event: VideoCompletedEvent) {
    this.logger.log("Video completed, generating presigned URL", {
      userId: event.userId,
      key: event.key,
    });

    try {
      const url = await this.storageService.getPresignedDownloadUrl(
        event.bucket,
        event.key,
        900,
      );

      const payload: VideoReadyPayload = {
        url,
        videoId: event.videoId,
      };

      this.gateway.emitToUser(event.userId, "tool_job_updated", {
        toolId: "video-generator",
        jobId: event.videoId,
        status: "completed",
        payload,
      } satisfies ToolJobUpdatePayload);

      this.logger.log("Emitted tool_job_updated", {
        userId: event.userId,
      });
    } catch (error) {
      this.logger.error("Failed to generate presigned URL", {
        error: (error as Error).message,
        userId: event.userId,
      });

      this.gateway.emitToUser(event.userId, "tool_job_updated", {
        toolId: "video-generator",
        jobId: "",
        status: "failed",
        payload: { error: "Failed to generate download URL" },
      } satisfies ToolJobUpdatePayload);
    }
  }

  private async handleFailed(event: VideoFailedEvent) {
    this.logger.warn("Video generation failed", {
      userId: event.userId,
      error: event.rawError || event.error,
    });

    this.gateway.emitToUser(event.userId, "tool_job_updated", {
      toolId: "video-generator",
      jobId: event.jobId || "",
      status: "failed",
      payload: { error: event.error },
    } satisfies ToolJobUpdatePayload);
  }
}
