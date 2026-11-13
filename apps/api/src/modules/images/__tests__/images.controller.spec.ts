import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { ImagesController } from "../images.controller";

describe("ImagesController", () => {
  const aiEngine = { generateImage: vi.fn() };
  const creditService = { hasEnoughCredits: vi.fn(), deduct: vi.fn() };
  const storage = {
    getProvider: vi.fn(() => "r2"),
    getDefaultBucket: vi.fn(() => "assets"),
    getPresignedDownloadUrl: vi.fn(),
    uploadBuffer: vi.fn(),
    delete: vi.fn(),
  };
  const sharingService = {
    getShareUrl: vi.fn((id: string) => `https://app/share/${id}`),
  };
  const fetchMock = vi.fn();
  const controller = new ImagesController(
    aiEngine as never,
    creditService as never,
    storage as never,
    sharingService as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requires authentication", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ImagesController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  describe("listImages", () => {
    it("paginates the user's images for the active storage provider", async () => {
      prismaMock.generatedImage.findMany.mockResolvedValue([]);
      prismaMock.generatedImage.count.mockResolvedValue(41);

      const result = await controller.listImages("u1", "3", "20", "video");

      const args = prismaMock.generatedImage.findMany.mock.calls[0]![0];
      expect(args.where).toEqual({
        userId: "u1",
        storageProvider: "r2",
        type: "VIDEO",
      });
      expect(args.skip).toBe(40);
      expect(args.take).toBe(20);
      expect(result.meta).toEqual({
        page: 3,
        limit: 20,
        total: 41,
        totalPages: 3,
      });
    });

    it("ignores unsupported type filters", async () => {
      prismaMock.generatedImage.findMany.mockResolvedValue([]);
      prismaMock.generatedImage.count.mockResolvedValue(0);

      await controller.listImages("u1", undefined, undefined, "audio");

      expect(
        prismaMock.generatedImage.findMany.mock.calls[0]![0].where,
      ).toEqual({
        userId: "u1",
        storageProvider: "r2",
      });
    });

    it("presigns stored keys, keeps absolute URLs, and falls back on presign errors", async () => {
      prismaMock.generatedImage.findMany.mockResolvedValue([
        { id: "1", url: "assets/u1/a.png" },
        { id: "2", url: "https://cdn.example/b.png" },
        { id: "3", url: "assets/u1/broken.png" },
        { id: "4", url: null },
      ]);
      prismaMock.generatedImage.count.mockResolvedValue(4);
      storage.getPresignedDownloadUrl
        .mockResolvedValueOnce("https://signed/a.png")
        .mockRejectedValueOnce(new Error("expired creds"));

      const { data } = await controller.listImages("u1");

      expect(data.map((i) => i.url)).toEqual([
        "https://signed/a.png",
        "https://cdn.example/b.png",
        "assets/u1/broken.png",
        "",
      ]);
      expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
        "assets",
        "u1/a.png",
        3600,
      );
    });
  });

  describe("ownership checks", () => {
    beforeEach(() =>
      prismaMock.generatedImage.findFirst.mockResolvedValue(null),
    );

    it.each([
      ["togglePublic", () => controller.togglePublic("u1", "img-of-u2")],
      ["getShareLink", () => controller.getShareLink("u1", "img-of-u2")],
      ["deleteImage", () => controller.deleteImage("u1", "img-of-u2")],
    ])("%s returns 404 for another user's image", async (_name, call) => {
      await expect(call()).rejects.toThrow(NotFoundException);
      expect(
        prismaMock.generatedImage.findFirst.mock.calls[0]![0].where,
      ).toEqual({
        id: "img-of-u2",
        userId: "u1",
      });
      expect(prismaMock.generatedImage.update).not.toHaveBeenCalled();
      expect(prismaMock.generatedImage.delete).not.toHaveBeenCalled();
    });
  });

  it("togglePublic flips the public flag", async () => {
    prismaMock.generatedImage.findFirst.mockResolvedValue({
      id: "i1",
      isPublic: false,
    });
    prismaMock.generatedImage.update.mockResolvedValue({ isPublic: true });

    expect(await controller.togglePublic("u1", "i1")).toEqual({
      isPublic: true,
    });
    expect(prismaMock.generatedImage.update.mock.calls[0]![0].data).toEqual({
      isPublic: true,
    });
  });

  it("getShareLink returns the share URL and current visibility", async () => {
    prismaMock.generatedImage.findFirst.mockResolvedValue({
      id: "i1",
      isPublic: true,
    });

    expect(await controller.getShareLink("u1", "i1")).toEqual({
      url: "https://app/share/i1",
      isPublic: true,
    });
  });

  describe("deleteImage", () => {
    it("deletes the stored object parsed from an absolute URL", async () => {
      prismaMock.generatedImage.findFirst.mockResolvedValue({
        id: "i1",
        url: "https://storage.example/assets/u1/pic.png",
      });

      expect(await controller.deleteImage("u1", "i1")).toEqual({
        success: true,
      });
      expect(storage.delete).toHaveBeenCalledWith("u1/pic.png", "assets");
      expect(prismaMock.generatedImage.delete).toHaveBeenCalledWith({
        where: { id: "i1" },
      });
    });

    it("handles raw bucket/key URLs and still deletes the row if storage fails", async () => {
      prismaMock.generatedImage.findFirst.mockResolvedValue({
        id: "i1",
        url: "assets/u1/pic.png",
      });
      storage.delete.mockRejectedValue(new Error("storage down"));

      expect(await controller.deleteImage("u1", "i1")).toEqual({
        success: true,
      });
      expect(storage.delete).toHaveBeenCalledWith("u1/pic.png", "assets");
      expect(prismaMock.generatedImage.delete).toHaveBeenCalled();
    });
  });

  describe("generateImage", () => {
    const dto = {
      prompt: "a cat astronaut",
      toolId: "thumbnail-generator",
      provider: "flux",
    };

    beforeEach(() => {
      creditService.hasEnoughCredits.mockResolvedValue(true);
      storage.uploadBuffer.mockImplementation(
        async (bucket: string, key: string) => ({ bucket, key }),
      );
      storage.getPresignedDownloadUrl.mockResolvedValue(
        "https://signed/final.png",
      );
    });

    it("rejects a blank prompt before checking credits", async () => {
      await expect(
        controller.generateImage("u1", { ...dto, prompt: "   " }),
      ).rejects.toThrow("Prompt is required");
      expect(creditService.hasEnoughCredits).not.toHaveBeenCalled();
    });

    it("rejects users without 10 credits before calling the AI", async () => {
      creditService.hasEnoughCredits.mockResolvedValue(false);

      await expect(controller.generateImage("u1", dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(creditService.hasEnoughCredits).toHaveBeenCalledWith("u1", 10);
      expect(aiEngine.generateImage).not.toHaveBeenCalled();
    });

    it("uploads base64 output, records the image and charges 10 credits", async () => {
      const png = Buffer.from("fake-png-bytes");
      aiEngine.generateImage.mockResolvedValue({
        model: "flux-pro",
        output: {
          type: "image",
          url: `data:image/png;base64,${png.toString("base64")}`,
        },
      });

      const result = await controller.generateImage("u1", dto);

      const [bucket, key, buffer, contentType] =
        storage.uploadBuffer.mock.calls[0]!;
      expect(bucket).toBe("assets");
      expect(key).toMatch(/^u1\/\d+-generated\.png$/);
      expect(buffer).toEqual(png);
      expect(contentType).toBe("image/png");
      expect(
        prismaMock.generatedImage.create.mock.calls[0]![0].data,
      ).toMatchObject({
        userId: "u1",
        toolId: "thumbnail-generator",
        prompt: "a cat astronaut",
        provider: "flux",
        storageProvider: "r2",
        model: "flux-pro",
        url: "https://signed/final.png",
        credits: 10,
      });
      expect(creditService.deduct).toHaveBeenCalledWith(
        "u1",
        10,
        "thumbnail-generator",
        "Image generation",
      );
      expect(result.data.output.url).toBe("https://signed/final.png");
    });

    it("re-hosts remote images and keeps the JPEG extension", async () => {
      aiEngine.generateImage.mockResolvedValue({
        output: { type: "image", url: "https://provider/img" },
      });
      fetchMock.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
        headers: { get: () => "image/jpeg" },
      });

      await controller.generateImage("u1", dto);

      expect(fetchMock).toHaveBeenCalledWith("https://provider/img");
      expect(storage.uploadBuffer.mock.calls[0]![1]).toMatch(/\.jpg$/);
    });

    it("keeps the provider URL when re-hosting fails", async () => {
      aiEngine.generateImage.mockResolvedValue({
        output: { type: "image", url: "https://provider/img" },
      });
      fetchMock.mockResolvedValue({ ok: false, status: 403 });

      const result = await controller.generateImage("u1", dto);

      expect(storage.uploadBuffer).not.toHaveBeenCalled();
      expect(result.data.output.url).toBe("https://provider/img");
      expect(creditService.deduct).toHaveBeenCalled();
    });

    it("does not charge when the provider returns no image", async () => {
      aiEngine.generateImage.mockResolvedValue({ output: { type: "image" } });

      await expect(controller.generateImage("u1", dto)).rejects.toThrow(
        "Image generation failed: AI provider returned no image URL",
      );
      expect(prismaMock.generatedImage.create).not.toHaveBeenCalled();
      expect(creditService.deduct).not.toHaveBeenCalled();
    });

    it.each([
      ["Provider billing limit reached", BadRequestException, /billing limit/],
      [
        "Provider rate limit exceeded",
        BadRequestException,
        /Too many requests/,
      ],
      ["Invalid API key", InternalServerErrorException, /configuration error/],
      [
        "socket hang up",
        InternalServerErrorException,
        /Image generation failed: socket hang up/,
      ],
    ])(
      "maps provider error %j to a user-facing error",
      async (message, type, pattern) => {
        aiEngine.generateImage.mockRejectedValue(new Error(message));

        const error = await controller
          .generateImage("u1", dto)
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(type);
        expect((error as Error).message).toMatch(pattern);
        expect(creditService.deduct).not.toHaveBeenCalled();
      },
    );
  });
});
