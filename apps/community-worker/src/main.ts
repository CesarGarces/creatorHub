import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module";

/**
 * Community worker — stateful process that owns the long-lived channel
 * connections (Telegram long polling today, WhatsApp sockets in phase 2)
 * and consumes the community BullMQ queues.
 *
 * It is intentionally separate from apps/api: an API redeploy must never
 * drop every creator's bot connections, and one Baileys socket per
 * channel cannot be replicated across stateless API replicas.
 */
async function bootstrap() {
  const logger = new Logger("CommunityWorker");

  // Model sync is owned by the API; the worker only reads ModelMetadata.
  process.env.ENABLE_MODEL_SYNC = process.env.ENABLE_MODEL_SYNC ?? "false";

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ["log", "warn", "error", "debug"],
  });

  // Graceful shutdown: drains BullMQ workers and disconnects channels
  // (ChannelManagerService.onModuleDestroy) on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  logger.log(
    "Community worker started — channel connectors and queue processors are live",
  );
}

void bootstrap();
