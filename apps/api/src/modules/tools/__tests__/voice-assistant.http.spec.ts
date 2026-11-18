/**
 * HTTP contract of Robotina (tool "voice-assistant"), through the same
 * global ValidationPipe as main.ts. Uses the tsc-built tool package (its
 * decorator metadata drives DTO validation, which esbuild would not emit).
 */
import "reflect-metadata";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";
import * as bodyParser from "body-parser";
import { Test } from "@nestjs/testing";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { JwtAuthGuard } from "@creator-hub/auth";
import { loadTools } from "@creator-hub/tool-sdk";
import "@creator-hub/voice-assistant";
import {
  VoiceAssistantController,
  VoiceAssistantService,
  type ReplyInput,
} from "@creator-hub/voice-assistant-backend";

const assistant = {
  reply: vi.fn(),
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  deleteConversation: vi.fn(),
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [VoiceAssistantController],
    providers: [{ provide: VoiceAssistantService, useValue: assistant }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (ctx: {
        switchToHttp: () => { getRequest: () => { user?: unknown } };
      }) => {
        ctx.switchToHttp().getRequest().user = { id: "u1" };
        return true;
      },
    })
    .compile();

  app = moduleRef.createNestApplication({ bodyParser: false });
  app.use(bodyParser.json({ limit: "50mb" }));
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  for (const fn of Object.values(assistant)) fn.mockReset();
});

const body = {
  content: "  Hola Robotina  ",
  spoken: true,
  model: "deepseek-ai/DeepSeek-V4-Flash",
  temperature: 0.7,
  maxTokens: 300,
  languageHint: "es",
};

describe("voice-assistant tool", () => {
  it("is discovered by the Tool SDK as an active tool with its frontend route", () => {
    // Same path as ToolDiscoveryService at startup.
    const tool = loadTools().manifests.find((t) => t.id === "voice-assistant");
    expect(tool).toMatchObject({
      category: "assistant",
      creditsPerUse: 1,
      status: "active",
      frontend: {
        routes: [{ path: "/tools/voice-assistant", showInNav: true }],
      },
    });
  });
});

describe("POST /api/v1/tools/voice-assistant/messages", () => {
  it("streams the reply as Server-Sent Events", async () => {
    assistant.reply.mockImplementation(async (input: ReplyInput) => {
      input.onEvent({ type: "delta", content: "¡Hola!" });
      input.onEvent({
        type: "done",
        messageId: "m2",
        content: "¡Hola!",
        language: "es",
        audioMs: 800,
        credits: 1,
        balance: 10,
      });
    });

    const res = await request(app.getHttpServer())
      .post("/api/v1/tools/voice-assistant/messages")
      .send(body);

    expect(res.status).toBe(201);
    expect(res.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect(res.text).toBe(
      `data: ${JSON.stringify({ type: "delta", content: "¡Hola!" })}\n\n` +
        `data: ${JSON.stringify({
          type: "done",
          messageId: "m2",
          content: "¡Hola!",
          language: "es",
          audioMs: 800,
          credits: 1,
          balance: 10,
        })}\n\n`,
    );
    expect(assistant.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        content: "Hola Robotina", // trimmed by the DTO
        spoken: true,
        modelId: "deepseek-ai/DeepSeek-V4-Flash",
        languageHint: "es",
      }),
    );
  });

  it.each([
    [{ ...body, content: "   " }, "content"],
    [{ ...body, spoken: undefined }, "spoken"],
    [{ ...body, model: "" }, "model"],
    [{ ...body, maxTokens: 99_999 }, "maxTokens"],
    [{ ...body, languageHint: "fr" }, "languageHint"],
    // The voice is never chosen by the client: always Aura-2 by language.
    [{ ...body, voice: "aura-2-thalia-en" }, "voice"],
    [{ ...body, ttsModel: "aura-1" }, "ttsModel"],
  ])(
    "rejects invalid bodies before streaming (%#: %s)",
    async (invalid, field) => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/tools/voice-assistant/messages")
        .send(invalid);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain(field);
      expect(assistant.reply).not.toHaveBeenCalled();
    },
  );
});

describe("conversations", () => {
  it("lists with coerced paging", async () => {
    assistant.listConversations.mockResolvedValue({
      data: [],
      meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });
    const res = await request(app.getHttpServer()).get(
      "/api/v1/tools/voice-assistant/conversations?page=2&limit=5",
    );
    expect(res.status).toBe(200);
    expect(assistant.listConversations).toHaveBeenCalledWith("u1", 2, 5);
  });

  it("rejects page sizes over 50", async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/v1/tools/voice-assistant/conversations?limit=51",
    );
    expect(res.status).toBe(400);
  });

  it("reads and deletes one conversation", async () => {
    assistant.getConversation.mockResolvedValue({ id: "c1", messages: [] });
    const get = await request(app.getHttpServer()).get(
      "/api/v1/tools/voice-assistant/conversations/c1",
    );
    expect(get.body).toEqual({
      success: true,
      data: { id: "c1", messages: [] },
    });
    expect(assistant.getConversation).toHaveBeenCalledWith("u1", "c1");

    assistant.deleteConversation.mockResolvedValue(undefined);
    const del = await request(app.getHttpServer()).delete(
      "/api/v1/tools/voice-assistant/conversations/c1",
    );
    expect(del.status).toBe(200);
    expect(assistant.deleteConversation).toHaveBeenCalledWith("u1", "c1");
  });
});
