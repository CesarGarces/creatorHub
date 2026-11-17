/**
 * HTTP contract of the AI Video Analyzer & Smart Clipper, through the same
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
import "@creator-hub/video-clipper";
import {
  VideoClipperController,
  VideoClipperService,
} from "@creator-hub/video-clipper-backend";

const FRAME = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

const clipper = {
  estimate: vi.fn(),
  analyze: vi.fn(),
  listAnalyses: vi.fn(),
  getAnalysis: vi.fn(),
  deleteAnalysis: vi.fn(),
};

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [VideoClipperController],
    providers: [{ provide: VideoClipperService, useValue: clipper }],
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
  for (const fn of Object.values(clipper)) fn.mockReset();
});

const body = {
  model: "google/gemini-2.5-flash",
  video: {
    fileName: "vlog.mp4",
    durationSec: 95.5,
    width: 1920,
    height: 1080,
    sizeBytes: 120_000_000,
    mimeType: "video/mp4",
  },
  frames: [
    { timestamp: 4, image: FRAME },
    { timestamp: 50, image: FRAME },
  ],
  platform: "instagram-reels",
  language: "pt",
};

describe("video-clipper tool", () => {
  it("is discovered by the Tool SDK as an active tool with its frontend route", () => {
    // Same path as ToolDiscoveryService at startup.
    const tool = loadTools().manifests.find((t) => t.id === "video-clipper");
    expect(tool).toMatchObject({
      category: "video",
      creditsPerUse: 0,
      status: "active",
      frontend: { routes: [{ path: "/tools/video-clipper" }] },
    });
  });
});

describe("POST /api/v1/tools/video-clipper/analyses", () => {
  it("validates the body and passes the user, keyframes and options to the service", async () => {
    clipper.analyze.mockResolvedValue({
      analysisId: "va1",
      result: { highlights: [] },
      creditsCharged: 4,
    });

    const res = await request(app.getHttpServer())
      .post("/api/v1/tools/video-clipper/analyses")
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        analysisId: "va1",
        result: { highlights: [] },
        creditsCharged: 4,
      },
    });
    expect(clipper.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        modelId: "google/gemini-2.5-flash",
        platform: "instagram-reels",
        language: "pt",
        video: expect.objectContaining({
          fileName: "vlog.mp4",
          durationSec: 95.5,
        }),
        frames: [
          expect.objectContaining({ timestamp: 4, image: FRAME }),
          expect.objectContaining({ timestamp: 50, image: FRAME }),
        ],
      }),
    );
  });

  it("rejects files over 250 MB before any AI work", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/tools/video-clipper/analyses")
      .send({
        ...body,
        video: { ...body.video, sizeBytes: 300 * 1024 * 1024 },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(
      "video.Videos larger than 250 MB are not supported yet",
    );
    expect(clipper.analyze).not.toHaveBeenCalled();
  });

  it("never accepts the video itself or non-image keyframes", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/tools/video-clipper/analyses")
      .send({
        ...body,
        videoData: "AAAA",
        frames: [{ timestamp: 1, image: "data:video/mp4;base64,AAAA" }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        "property videoData should not exist",
        "frames.0.Keyframes must be JPEG, PNG or WebP data URLs",
      ]),
    );
    expect(clipper.analyze).not.toHaveBeenCalled();
  });
});

describe("GET endpoints", () => {
  it("coerces the estimate query", async () => {
    clipper.estimate.mockResolvedValue({ total: 8 });
    const res = await request(app.getHttpServer())
      .get("/api/v1/tools/video-clipper/estimate")
      .query({ model: "google/gemini-2.5-flash", frames: "20" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { total: 8 } });
    expect(clipper.estimate).toHaveBeenCalledWith(
      "u1",
      "google/gemini-2.5-flash",
      20,
    );
  });

  it("rejects an estimate for too many keyframes", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/tools/video-clipper/estimate")
      .query({ model: "m", frames: "64" });
    expect(res.status).toBe(400);
  });

  it("serves the limits and the paginated history", async () => {
    const limits = await request(app.getHttpServer()).get(
      "/api/v1/tools/video-clipper/limits",
    );
    expect(limits.body.data).toMatchObject({
      maxVideoBytes: 250 * 1024 * 1024,
      roadmap: { heavyFilesMaxBytes: 10 * 1024 ** 3 },
    });

    clipper.listAnalyses.mockResolvedValue({ data: [], meta: { page: 2 } });
    const list = await request(app.getHttpServer())
      .get("/api/v1/tools/video-clipper/analyses")
      .query({ page: "2", limit: "5" });
    expect(list.status).toBe(200);
    expect(clipper.listAnalyses).toHaveBeenCalledWith("u1", 2, 5);

    clipper.deleteAnalysis.mockResolvedValue(undefined);
    const del = await request(app.getHttpServer()).delete(
      "/api/v1/tools/video-clipper/analyses/va1",
    );
    expect(del.status).toBe(200);
    expect(clipper.deleteAnalysis).toHaveBeenCalledWith("u1", "va1");
  });
});
