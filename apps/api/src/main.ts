/**
 * Sentry initialization MUST happen before anything else.
 * This captures bootstrap errors (module loading, DI, etc.)
 */
import "./common/sentry/sentry.init";

import * as Sentry from "@sentry/nestjs";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import * as bodyParser from "body-parser";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { SentryExceptionFilter } from "./common/filters/sentry-exception.filter";
import { SentryInterceptor } from "./common/interceptors/sentry.interceptor";

async function bootstrap() {
  // Disable built-in body parser so we can capture raw body for webhook verification
  const app = await NestFactory.create(AppModule, { bodyParser: false as any });

  // ─── Sentry Global Filter & Interceptor ────────────────────────────────
  // Exception filter: captures errors → Sentry (with smart filtering)
  // Interceptor: tracks request performance + adds breadcrumbs
  app.useGlobalFilters(new SentryExceptionFilter());
  app.useGlobalInterceptors(new SentryInterceptor());

  // Attach raw body to requests for signature verification (used by webhook endpoints)
  const rawBodySaver = (req: any, res: any, buf: Buffer) => {
    if (buf && buf.length) {
      req.rawBody = buf;
    }
  };

  app.use(bodyParser.json({ verify: rawBodySaver, limit: "50mb" }));
  app.use(
    bodyParser.urlencoded({
      extended: true,
      verify: rawBodySaver,
      limit: "50mb",
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Creator Hub API")
    .setDescription("Creator Hub API documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  app.setGlobalPrefix("api/v1");
  const frontendUrl = (
    process.env.FRONTEND_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");
  const adminUrl = (process.env.ADMIN_URL || "http://localhost:3003").replace(
    /\/+$/,
    "",
  );
  const devOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:3003",
    "http://127.0.0.1:3003",
  ];
  const allowedOrigins = [...new Set([frontendUrl, adminUrl, ...devOrigins])];
  console.log(`[CORS] Allowed origins: ${allowedOrigins.join(", ")}`);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);

  // ─── Graceful Shutdown — Flush Sentry Events ────────────────────────────
  // Render free tier can kill the process at any time (spindown, OOM, deploy).
  // We MUST flush pending Sentry events before the process exits.
  const gracefulShutdown = async (signal: string) => {
    console.log(
      `\n[Sentry] Received ${signal}. Flushing events before shutdown...`,
    );

    // Give Sentry time to send buffered events
    await Sentry.flush(5000);

    console.log("[Sentry] Flush complete. Exiting.");
    process.exit(0);
  };

  // Handle termination signals (Render sends SIGTERM before killing)
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle unhandled rejections (capture before crashing)
  process.on("unhandledRejection", (reason, promise) => {
    console.error(
      "[Sentry] Unhandled Rejection at:",
      promise,
      "reason:",
      reason,
    );
    Sentry.captureException(reason);
  });

  // Handle uncaught exceptions (capture before crashing)
  process.on("uncaughtException", (error) => {
    console.error("[Sentry] Uncaught Exception:", error);
    Sentry.captureException(error);
    // Flush synchronously before exit (best effort)
    Sentry.flush(2000).then(() => {
      process.exit(1);
    });
  });
}

bootstrap();
