import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";
import type { StorageService } from "@creator-hub/storage";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { AssetEngagementService } from "../asset-engagement.service";
import { AssetEngagementController } from "../asset-engagement.controller";
import { AssetEngagementQueryDto } from "../dto/asset-engagement-query.dto";
import { resolveStorageRef } from "../storage-ref";

const CREATED = new Date("2026-11-10T12:00:00.000Z");

const storage = {
  getProvider: vi.fn(() => "r2"),
  getPresignedDownloadUrl: vi.fn(
    async (bucket: string, key: string) => `https://signed/${bucket}/${key}`,
  ),
};

const row = (extra: Record<string, unknown>) => ({
  id: "a1",
  type: "IMAGE",
  prompt: "Neon gaming thumbnail",
  url: "assets/u1/a1.png",
  metadata: null,
  likeCount: 0,
  viewCount: 0,
  isPublic: true,
  createdAt: CREATED,
  ...extra,
});

function mockRows(
  rows: ReturnType<typeof row>[],
  sums = { likes: 12, views: 340, assets: 9, publicAssets: 3 },
) {
  prismaMock.generatedImage.aggregate.mockResolvedValue({
    _sum: { likeCount: sums.likes, viewCount: sums.views },
    _count: { _all: sums.assets },
  });
  prismaMock.generatedImage.count.mockResolvedValue(sums.publicAssets);
  prismaMock.generatedImage.findMany.mockResolvedValue(rows);
}

describe("AssetEngagementService", () => {
  const service = new AssetEngagementService(
    storage as unknown as StorageService,
  );

  beforeEach(() => {
    resetPrismaMock();
    vi.clearAllMocks();
  });

  it("totals the likes and views of the user's assets on the current storage", async () => {
    mockRows([]);

    const result = await service.getEngagement("u1");

    expect(result.totals).toEqual({
      likes: 12,
      views: 340,
      assets: 9,
      publicAssets: 3,
    });
    const where = { userId: "u1", storageProvider: "r2" };
    expect(prismaMock.generatedImage.aggregate).toHaveBeenCalledWith({
      where,
      _sum: { likeCount: true, viewCount: true },
      _count: { _all: true },
    });
    expect(prismaMock.generatedImage.count).toHaveBeenCalledWith({
      where: { ...where, isPublic: true },
    });
  });

  it("counts zero when the user has no assets (null sums)", async () => {
    prismaMock.generatedImage.aggregate.mockResolvedValue({
      _sum: { likeCount: null, viewCount: null },
      _count: { _all: 0 },
    });
    prismaMock.generatedImage.count.mockResolvedValue(0);
    prismaMock.generatedImage.findMany.mockResolvedValue([]);

    expect(await service.getEngagement("u1")).toEqual({
      totals: { likes: 0, views: 0, assets: 0, publicAssets: 0 },
      top: [],
    });
  });

  it("lists assets with likes or views, most liked then most viewed", async () => {
    mockRows([]);

    await service.getEngagement("u1", 6);

    const query = prismaMock.generatedImage.findMany.mock.calls[0]![0];
    expect(query.where).toEqual({
      userId: "u1",
      storageProvider: "r2",
      OR: [{ likeCount: { gt: 0 } }, { viewCount: { gt: 0 } }],
    });
    expect(query.orderBy).toEqual([
      { likeCount: "desc" },
      { viewCount: "desc" },
      { createdAt: "desc" },
    ]);
    expect(query.take).toBe(6);
  });

  it("lists four by default", async () => {
    mockRows([]);
    await service.getEngagement("u1");
    expect(prismaMock.generatedImage.findMany.mock.calls[0]![0].take).toBe(4);
  });

  it("previews an image with a signed URL of the image", async () => {
    mockRows([row({ likeCount: 5, viewCount: 40 })]);

    const [asset] = (await service.getEngagement("u1")).top;

    expect(asset).toEqual({
      id: "a1",
      type: "IMAGE",
      title: "Neon gaming thumbnail",
      previewUrl: "https://signed/assets/u1/a1.png",
      likeCount: 5,
      viewCount: 40,
      isPublic: true,
      createdAt: CREATED.toISOString(),
    });
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      "assets",
      "u1/a1.png",
      3600,
    );
  });

  it("previews a video with its thumbnail, never the video file", async () => {
    mockRows([
      row({
        id: "v1",
        type: "VIDEO",
        url: "videos/u1/v1.mp4",
        metadata: { thumbnailKey: "videos/u1/v1-thumb.jpg" },
        likeCount: 2,
      }),
      row({
        id: "v2",
        type: "VIDEO",
        url: "videos/u1/v2.mp4",
        metadata: {},
        viewCount: 3,
      }),
    ]);

    const [withThumb, withoutThumb] = (await service.getEngagement("u1")).top;

    expect(withThumb!.previewUrl).toBe("https://signed/videos/u1/v1-thumb.jpg");
    expect(withoutThumb!.previewUrl).toBeNull();
    const signed = storage.getPresignedDownloadUrl.mock.calls.map(
      ([, key]) => key,
    );
    expect(signed.some((key) => key.endsWith(".mp4"))).toBe(false);
  });
});

describe("resolveStorageRef", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps full URLs and signs storage references", async () => {
    expect(await resolveStorageRef(storage, "https://cdn/x.png", 60)).toBe(
      "https://cdn/x.png",
    );
    expect(await resolveStorageRef(storage, "b/k/x.png", 60)).toBe(
      "https://signed/b/k/x.png",
    );
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      "b",
      "k/x.png",
      60,
    );
  });

  it("gives null for nothing, malformed references and signing failures", async () => {
    expect(await resolveStorageRef(storage, null, 60)).toBeNull();
    expect(await resolveStorageRef(storage, "no-key", 60)).toBeNull();
    storage.getPresignedDownloadUrl.mockRejectedValueOnce(new Error("R2 down"));
    expect(await resolveStorageRef(storage, "b/k.png", 60)).toBeNull();
  });
});

describe("GET /user/assets/engagement query", () => {
  // Same options as the global pipe in main.ts.
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });
  const validate = (query: unknown) =>
    pipe.transform(query, { type: "query", metatype: AssetEngagementQueryDto });

  it("accepts no limit, or a limit from 1 to 12 (as a query string)", async () => {
    await expect(validate({})).resolves.toEqual({});
    await expect(validate({ limit: "8" })).resolves.toMatchObject({
      limit: 8,
    });
  });

  it.each([["0"], ["13"], ["2.5"], ["many"]])(
    "rejects limit=%s",
    async (limit) => {
      await expect(validate({ limit })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it("rejects unexpected parameters", async () => {
    await expect(validate({ userId: "someone-else" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("AssetEngagementController", () => {
  it("serves the signed-in user only, behind the JWT guard", async () => {
    const service = { getEngagement: vi.fn().mockResolvedValue("result") };
    const controller = new AssetEngagementController(
      service as unknown as AssetEngagementService,
    );

    expect(Reflect.getMetadata(PATH_METADATA, AssetEngagementController)).toBe(
      "user/assets",
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AssetEngagementController),
    ).toEqual([JwtAuthGuard]);
    await expect(controller.getEngagement("u1", { limit: 8 })).resolves.toBe(
      "result",
    );
    expect(service.getEngagement).toHaveBeenCalledWith("u1", 8);
  });
});
