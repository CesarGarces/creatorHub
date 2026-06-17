import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Inject } from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { getFriendlyError } from "@creator-hub/shared-utils";
import {
  DomainEventPublisher,
  DOMAIN_EVENT_PUBLISHER,
} from "@creator-hub/domain-events";
import type {
  TranslationCompletedEvent,
  TranslationFailedEvent,
} from "@creator-hub/shared-types";

const TRANSLATION_COMPLETED_CHANNEL = "translation:completed";
const TRANSLATION_FAILED_CHANNEL = "translation:failed";

const SYSTEM_PROMPT = `Actúas como un traductor profesional y experto en localización de contenido para creadores de internet.
Traduce el texto del usuario al idioma de destino de forma natural, manteniendo el impacto emocional y el tono original.
REGLA CRÍTICA: Devuelve ÚNICAMENTE la traducción resultante. No agregues introducciones, notas, ni ningún otro texto. Solo la traducción.`;

@Processor("translation")
export class ContentTranslatorProcessor extends WorkerHost {
  private logger = new Logger("ContentTranslatorProcessor");

  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private eventPublisher: DomainEventPublisher,
  ) {
    super();
  }

  async process(
    job: Job<{
      userId: string;
      text: string;
      targetLanguage: string;
      provider?: string;
      providerId?: string;
      providerTier?: "FREE" | "PRO";
      creditCost: number;
    }>,
  ): Promise<{ userId: string; translationId: string; content: string }> {
    const { userId, text, targetLanguage, provider, providerId, creditCost } =
      job.data;

    this.logger.info("Processing translation job", {
      jobId: job.id,
      userId,
      textLength: text.length,
      targetLanguage,
    });

    const prompt = `Translate the following text to ${targetLanguage}:\n\n${text}`;
    const startTime = Date.now();

    let result;
    try {
      result = await this.aiEngine.execute({
        taskType: "text-generation",
        provider: provider as any,
        prompt,
        userId,
        toolId: "content-translator",
      });
    } catch (error) {
      const msg = (error as Error).message || "Unknown AI error";
      this.logger.error("Translation AI error", {
        jobId: job.id,
        error: msg,
        provider,
      });
      throw new Error(`AI provider error: ${msg}`);
    }

    const output = result.output as { type: string; content: string };
    if (!output?.content) {
      throw new Error("AI provider returned no translation content");
    }

    const duration = Date.now() - startTime;

    const log = await prisma.aIRequestLog.create({
      data: {
        userId,
        toolId: "content-translator",
        provider: result.provider,
        model: result.model,
        taskType: "text-generation",
        prompt: text,
        response: {
          targetLanguage,
          translatedText: output.content,
          provider: result.provider,
          model: result.model,
        },
        credits: creditCost,
        latency: duration,
        success: true,
      },
    });

    await this.creditService.deduct(
      userId,
      creditCost,
      "content-translator",
      `Translation to ${targetLanguage}: ${text.slice(0, 50)}...`,
    );

    this.logger.info("Translation job completed", {
      jobId: job.id,
      translationId: log.id,
      duration,
    });

    return {
      userId,
      translationId: log.id,
      content: output.content,
    };
  }

  @OnWorkerEvent("completed")
  async onCompleted(
    job: Job,
    result: { userId: string; translationId: string; content: string },
  ) {
    this.logger.info("Translation job finished, publishing event", {
      jobId: job.id,
      userId: result.userId,
    });

    const event: TranslationCompletedEvent = {
      userId: result.userId,
      translationId: result.translationId,
      content: result.content,
    };

    await this.eventPublisher.publish(TRANSLATION_COMPLETED_CHANNEL, event);
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

    this.logger.error("Translation job failed", {
      jobId: job.id,
      error: cleanMessage,
    });

    const userId = job.data?.userId;
    if (userId) {
      const friendlyMessage = getFriendlyError(cleanMessage);
      const event: TranslationFailedEvent = {
        userId,
        error: friendlyMessage,
        rawError: cleanMessage,
        jobId: job.id,
      };
      await this.eventPublisher.publish(TRANSLATION_FAILED_CHANNEL, event);
    }
  }
}
