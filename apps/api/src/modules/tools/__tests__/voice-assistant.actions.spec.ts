/**
 * Robotina's actions end to end on the API: HTTP → VoiceAssistantService →
 * AssistantActionRegistry (global ToolSdkModule) → the real Content Planner
 * module and service → the database write. Only the LLM (scripted), the
 * database (in-memory mock behind the `prisma` proxy), credits and speech
 * are fakes.
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
import { ProviderRegistry } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { PlatformUsageLogger } from "@creator-hub/analytics";
import { TTSEngineService } from "@creator-hub/tts-engine";
import { ContentPlannerModule } from "@creator-hub/content-planner-backend";
import {
  VoiceAssistantController,
  VoiceAssistantService,
} from "@creator-hub/voice-assistant-backend";
import {
  addDaysToIsoDate,
  zonedDateTimeToUtc,
  zonedParts,
} from "@creator-hub/shared-utils";
import type { AIStreamChunk } from "@creator-hub/shared-types";
import { ToolSdkModule } from "../../../tool-sdk.module";
import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";

const ZONE = "America/Bogota";
/** Tomorrow in Bogotá: always in the future, whenever the test runs. */
const TOMORROW = addDaysToIsoDate(zonedParts(new Date(), ZONE).date, 1);

/** What the scripted model writes, one entry per model call. */
let rounds: string[] = [];
const requests: Array<{ prompt: string }> = [];
const provider = {
  async *generateStream(req: {
    prompt: string;
  }): AsyncGenerator<AIStreamChunk> {
    requests.push(req);
    const text = rounds[requests.length - 1] ?? "";
    for (let i = 0; i < text.length; i += 9) {
      yield { type: "content", content: text.slice(i, i + 9) };
    }
    yield { type: "done" };
  },
  generate: vi.fn(),
};

let app: INestApplication;
const globalPrisma = globalThis as { prisma?: unknown };

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  globalPrisma.prisma = prismaMock; // `prisma` is a proxy over this
  const moduleRef = await Test.createTestingModule({
    imports: [ToolSdkModule, ContentPlannerModule],
    controllers: [VoiceAssistantController],
    providers: [
      VoiceAssistantService,
      {
        provide: ProviderRegistry,
        useValue: {
          getStreamingProviderForModel: async () => provider,
          getProviderForModel: async () => provider,
        },
      },
      {
        provide: CreditService,
        useValue: {
          hasEnoughCredits: async () => true,
          deduct: vi.fn(async () => true),
          getBalance: async () => 41,
        },
      },
      { provide: PlatformUsageLogger, useValue: { logUsage: async () => {} } },
      {
        provide: TTSEngineService,
        useValue: { isAvailable: () => false, voiceFor: () => null },
      },
    ],
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
  app.use(bodyParser.json());
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
  delete globalPrisma.prisma;
  vi.restoreAllMocks();
});

beforeEach(() => {
  resetPrismaMock();
  requests.length = 0;
  prismaMock.modelMetadata.findFirst.mockResolvedValue({
    modelId: "m1",
    displayName: "Model",
    tier: "FREE",
  });
  prismaMock.user.findUnique.mockResolvedValue({ plan: "FREE", name: "Ana" });
  prismaMock.voiceConversation.create.mockImplementation(async ({ data }) => ({
    id: "conv1",
    language: "en",
    ...data,
  }));
  prismaMock.voiceConversation.update.mockResolvedValue({});
  let n = 0;
  prismaMock.voiceMessage.create.mockImplementation(async ({ data }) => ({
    id: `m${++n}`,
    ...data,
  }));
  prismaMock.voiceMessage.findMany.mockResolvedValue([]);
  prismaMock.contentEvent.create.mockImplementation(async ({ data }) => ({
    id: "ev1",
    ...data,
    project: null,
    customType: null,
  }));
  prismaMock.contentEvent.findMany.mockResolvedValue([]);
});

const events = (text: string) =>
  text
    .split("\n\n")
    .filter((block) => block.startsWith("data: "))
    .map((block) => JSON.parse(block.slice(6)));

describe("Robotina schedules a plan", () => {
  it("creates the session in the user's calendar, at their local time", async () => {
    rounds = [
      `Perfecto, lo agendo ahora. <action>{"name":"calendar.create_event","args":{"title":"Grabar el unboxing","date":"${TOMORROW}","startTime":"15:00","endTime":"16:30","type":"RECORDING"}}</action>`,
      "¡Listo! Quedó para mañana de tres a cuatro y media.",
    ];

    const res = await request(app.getHttpServer())
      .post("/api/v1/tools/voice-assistant/messages")
      .send({
        content:
          "Agenda grabar el unboxing mañana de 3 a 4 y media de la tarde",
        spoken: false,
        model: "m1",
        timeZone: ZONE,
      });

    const startAt = zonedDateTimeToUtc(TOMORROW, "15:00", ZONE);
    const endAt = zonedDateTimeToUtc(TOMORROW, "16:30", ZONE);

    // The database write of the Content Planner itself.
    expect(prismaMock.contentEvent.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.contentEvent.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      userId: "u1",
      title: "Grabar el unboxing",
      type: "RECORDING",
      status: "PLANNED",
      startAt,
      endAt,
      reminderMinutes: 15,
      remindAt: new Date(startAt.getTime() - 15 * 60_000),
    });

    // What the browser received.
    const stream = events(res.text);
    // Consecutive deltas collapsed: text, the action, more text, done.
    expect(
      stream
        .map((e) => (e.type === "action" ? `action:${e.status}` : e.type))
        .filter((type, i, all) => type !== "delta" || all[i - 1] !== "delta"),
    ).toEqual([
      "start",
      "delta",
      "action:running",
      "action:done",
      "delta",
      "done",
    ]);
    expect(res.text).not.toContain("<action>");
    const done = stream.find((e) => e.type === "action" && e.status === "done");
    expect(done.data).toMatchObject({
      kind: "calendar-event",
      event: {
        id: "ev1",
        title: "Grabar el unboxing",
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
      conflicts: [],
    });

    // She got the real result to confirm it.
    expect(requests[1]!.prompt).toContain(
      `Created "Grabar el unboxing" (RECORDING) on ${zonedParts(startAt, ZONE).weekday} ${TOMORROW} 15:00–16:30 (America/Bogota)`,
    );
    const saved = prismaMock.voiceMessage.create.mock.calls.find(
      ([arg]) => arg.data.role === "assistant",
    )![0].data;
    expect(saved.content).toBe(
      "Perfecto, lo agendo ahora. ¡Listo! Quedó para mañana de tres a cuatro y media.",
    );
    expect(saved.actions[0]).toMatchObject({
      name: "calendar.create_event",
      status: "done",
    });
  });

  it("doesn't guess a missing end time: nothing is written, she asks", async () => {
    rounds = [
      `<action>{"name":"calendar.create_event","args":{"title":"Editar","date":"${TOMORROW}","startTime":"10:00"}}</action>`,
      "¿Hasta qué hora sería?",
    ];

    const res = await request(app.getHttpServer())
      .post("/api/v1/tools/voice-assistant/messages")
      .send({
        content: "Agenda editar mañana a las 10",
        spoken: false,
        model: "m1",
        timeZone: ZONE,
      });

    expect(prismaMock.contentEvent.create).not.toHaveBeenCalled();
    const failed = events(res.text).find(
      (e) => e.type === "action" && e.status === "failed",
    );
    expect(failed.summary).toMatch(/Missing the end time/);
    expect(requests[1]!.prompt).toMatch(
      /^ACTION RESULT \(calendar\.create_event: failed\)/,
    );
  });

  it("answers 'do I have plans?' even when she first only announces the search", async () => {
    prismaMock.contentEvent.findMany.mockResolvedValue([
      {
        id: "ev7",
        title: "Grabar el intro",
        type: "RECORDING",
        status: "PLANNED",
        startAt: zonedDateTimeToUtc(TOMORROW, "09:00", ZONE),
        endAt: zonedDateTimeToUtc(TOMORROW, "10:00", ZONE),
      },
    ]);
    rounds = [
      "Ok, lo busco en este momento.", // no action: the server nudges
      `<action>{"name":"calendar.list_events","args":{"date":"${TOMORROW}"}}</action>`,
      "Mañana tienes una sesión: grabar el intro de nueve a diez.",
    ];

    const res = await request(app.getHttpServer())
      .post("/api/v1/tools/voice-assistant/messages")
      .send({
        content: "¿Tengo algún plan para mañana?",
        spoken: false,
        model: "m1",
        timeZone: ZONE,
      });

    expect(requests).toHaveLength(3);
    expect(requests[1]!.prompt).toMatch(/^SYSTEM NOTE/);
    const done = events(res.text).find(
      (e) => e.type === "action" && e.status === "done",
    );
    expect(done.data).toMatchObject({
      kind: "calendar-agenda",
      events: [{ id: "ev7", title: "Grabar el intro" }],
    });
    expect(requests[2]!.prompt).toContain('09:00–10:00 "Grabar el intro"');
    expect(events(res.text).at(-1)).toMatchObject({
      type: "done",
      content:
        "Ok, lo busco en este momento. Mañana tienes una sesión: grabar el intro de nueve a diez.",
    });
  });
});
