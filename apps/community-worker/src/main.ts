import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const logger = new Logger("CommunityWorker");

  process.env.ENABLE_MODEL_SYNC = process.env.ENABLE_MODEL_SYNC ?? "false";

  const app = await NestFactory.create(WorkerModule, {
    logger: ["log", "warn", "error", "debug"],
  });

  app.enableShutdownHooks();
  app.enableCors();

  // Minimal health check so Render detects the open port
  app
    .getHttpAdapter()
    .get("/", (_req, res) =>
      res.json({ status: "ok", service: "community-worker" }),
    );

  const port = process.env.PORT || 8080;
  await app.listen(port);

  logger.log(
    `Community worker started on port ${port} — channel connectors and queue processors are live`,
  );
}

void bootstrap();
