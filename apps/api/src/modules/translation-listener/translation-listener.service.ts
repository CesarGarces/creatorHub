import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { AppGateway } from "../websocket/websocket.gateway";
import {
  DomainEventSubscriber,
  DOMAIN_EVENT_SUBSCRIBER,
} from "@creator-hub/domain-events";
import type {
  TranslationCompletedEvent,
  TranslationFailedEvent,
  TranslationReadyPayload,
  ToolJobUpdatePayload,
} from "@creator-hub/shared-types";

const TRANSLATION_COMPLETED_CHANNEL = "translation:completed";
const TRANSLATION_FAILED_CHANNEL = "translation:failed";

@Injectable()
export class TranslationListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private logger = new Logger("TranslationListenerService");

  constructor(
    @Inject(DOMAIN_EVENT_SUBSCRIBER)
    private eventSubscriber: DomainEventSubscriber,
    private gateway: AppGateway,
  ) {}

  async onModuleInit() {
    await this.eventSubscriber.subscribe<TranslationCompletedEvent>(
      TRANSLATION_COMPLETED_CHANNEL,
      this.handleCompleted.bind(this),
    );

    await this.eventSubscriber.subscribe<TranslationFailedEvent>(
      TRANSLATION_FAILED_CHANNEL,
      this.handleFailed.bind(this),
    );

    this.logger.log("Subscribed to translation events");
  }

  async onModuleDestroy() {
    await this.eventSubscriber.unsubscribe(TRANSLATION_COMPLETED_CHANNEL);
    await this.eventSubscriber.unsubscribe(TRANSLATION_FAILED_CHANNEL);
    this.logger.log("Unsubscribed from translation events");
  }

  private async handleCompleted(event: TranslationCompletedEvent) {
    this.logger.log("Translation completed", {
      userId: event.userId,
      translationId: event.translationId,
    });

    const payload: TranslationReadyPayload = {
      content: event.content,
      translationId: event.translationId,
    };

    this.gateway.emitToUser(event.userId, "tool_job_updated", {
      toolId: "content-translator",
      jobId: event.translationId,
      status: "completed",
      payload,
    } satisfies ToolJobUpdatePayload);

    this.logger.log("Emitted translation tool_job_updated", {
      userId: event.userId,
    });
  }

  private async handleFailed(event: TranslationFailedEvent) {
    this.logger.warn("Translation failed", {
      userId: event.userId,
      error: event.rawError || event.error,
    });

    this.gateway.emitToUser(event.userId, "tool_job_updated", {
      toolId: "content-translator",
      jobId: event.jobId || "",
      status: "failed",
      payload: { error: event.error },
    } satisfies ToolJobUpdatePayload);
  }
}
