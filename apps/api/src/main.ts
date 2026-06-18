import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import * as bodyParser from "body-parser";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Disable built-in body parser so we can capture raw body for webhook verification
  const app = await NestFactory.create(AppModule, { bodyParser: false as any });

  // Attach raw body to requests for signature verification (used by webhook endpoints)
  const rawBodySaver = (req: any, res: any, buf: Buffer) => {
    if (buf && buf.length) {
      req.rawBody = buf;
    }
  };

  app.use(bodyParser.json({ verify: rawBodySaver }));
  app.use(bodyParser.urlencoded({ extended: true, verify: rawBodySaver }));

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
}

bootstrap();
