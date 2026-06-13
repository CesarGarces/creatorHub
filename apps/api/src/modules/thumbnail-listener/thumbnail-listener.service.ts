import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { StorageService } from "@creator-hub/storage";
import { AppGateway } from "../websocket/websocket.gateway";
import {
  DomainEventSubscriber,
  DOMAIN_EVENT_SUBSCRIBER,
} from "@creator-hub/domain-events";
import type {
  ThumbnailCompletedEvent,
  ThumbnailFailedEvent,
  ThumbnailReadyPayload,
  ToolJobUpdatePayload,
} from "@creator-hub/shared-types";

const THUMBNAIL_COMPLETED_CHANNEL = "thumbnail:completed";
const THUMBNAIL_FAILED_CHANNEL = "thumbnail:failed";

@Injectable()
export class ThumbnailListenerService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger("ThumbnailListenerService");

  constructor(
    @Inject(DOMAIN_EVENT_SUBSCRIBER)
    private eventSubscriber: DomainEventSubscriber,
    private storageService: StorageService,
    private gateway: AppGateway
  ) {}

  async onModuleInit() {
    await this.eventSubscriber.subscribe<ThumbnailCompletedEvent>(
      THUMBNAIL_COMPLETED_CHANNEL,
      this.handleCompleted.bind(this)
    );

    await this.eventSubscriber.subscribe<ThumbnailFailedEvent>(
      THUMBNAIL_FAILED_CHANNEL,
      this.handleFailed.bind(this)
    );

    this.logger.log("Subscribed to thumbnail events");
  }

  async onModuleDestroy() {
    await this.eventSubscriber.unsubscribe(THUMBNAIL_COMPLETED_CHANNEL);
    await this.eventSubscriber.unsubscribe(THUMBNAIL_FAILED_CHANNEL);
    this.logger.log("Unsubscribed from thumbnail events");
  }

  private async handleCompleted(event: ThumbnailCompletedEvent) {
    this.logger.log("Thumbnail completed, generating presigned URL", {
      userId: event.userId,
      key: event.key,
    });

    try {
      const url = await this.storageService.getPresignedDownloadUrl(
        event.bucket,
        event.key,
        900
      );

      const payload: ThumbnailReadyPayload = {
        url,
        imageId: event.imageId,
      };

      this.gateway.emitToUser(event.userId, "tool_job_updated", {
        toolId: "thumbnail-generator",
        jobId: event.imageId,
        status: "completed",
        payload,
      } satisfies ToolJobUpdatePayload);

      this.logger.log("Emitted tool_job_updated", { userId: event.userId });
    } catch (error) {
      this.logger.error("Failed to generate presigned URL", {
        error: (error as Error).message,
        userId: event.userId,
      });

      this.gateway.emitToUser(event.userId, "tool_job_updated", {
        toolId: "thumbnail-generator",
        jobId: "",
        status: "failed",
        payload: { error: "Failed to generate download URL" },
      } satisfies ToolJobUpdatePayload);
    }
  }

  private async handleFailed(event: ThumbnailFailedEvent) {
    this.logger.warn("Thumbnail generation failed", {
      userId: event.userId,
      error: event.rawError || event.error,
    });

    this.gateway.emitToUser(event.userId, "tool_job_updated", {
      toolId: "thumbnail-generator",
      jobId: event.jobId || "",
      status: "failed",
      payload: { error: event.error },
    } satisfies ToolJobUpdatePayload);
  }
}
