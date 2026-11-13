import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const upload = vi.hoisted(() => ({
  params: null as null | Record<string, unknown>,
  done: vi.fn(),
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    constructor(options: { params: Record<string, unknown> }) {
      upload.params = options.params;
    }
    done = upload.done;
  },
}));

import { StorageService } from "../storage.service";

const ENV_KEYS = [
  "STORAGE_PROVIDER",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "AWS_S3_ENDPOINT",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
];

describe("StorageService", () => {
  const saved: Record<string, string | undefined> = {};
  let send: ReturnType<typeof vi.fn<(...args: any[]) => Promise<any>>>;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    vi.spyOn(console, "log").mockImplementation(() => {});
    send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never) as unknown as typeof send;
    upload.done.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.restoreAllMocks();
  });

  function r2() {
    process.env.STORAGE_PROVIDER = "r2";
    process.env.R2_ENDPOINT = "https://acct123.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = "AKIDTEST";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    return new StorageService();
  }

  describe("configuration", () => {
    it("defaults to R2 and requires its endpoint", () => {
      expect(() => new StorageService()).toThrow(/R2_ENDPOINT is required/);
    });

    it("uses R2 with the configured bucket", () => {
      process.env.R2_BUCKET = "my-assets";
      const service = r2();

      expect(service.getProvider()).toBe("r2");
      expect(service.getDefaultBucket()).toBe("my-assets");
    });

    it("requires an endpoint for MinIO", () => {
      process.env.STORAGE_PROVIDER = "minio";
      expect(() => new StorageService()).toThrow(/AWS_S3_ENDPOINT is required/);

      process.env.AWS_S3_ENDPOINT = "http://localhost:9000";
      const service = new StorageService();
      expect(service.getProvider()).toBe("minio");
      expect(service.getDefaultBucket()).toBe("creatorhub-assets");
    });

    it("supports plain AWS S3 without a custom endpoint", () => {
      process.env.STORAGE_PROVIDER = "s3";
      process.env.AWS_S3_BUCKET = "prod-bucket";

      const service = new StorageService();

      expect(service.getProvider()).toBe("s3");
      expect(service.getDefaultBucket()).toBe("prod-bucket");
    });
  });

  describe("uploadBuffer", () => {
    it("refuses empty uploads without calling S3", async () => {
      const service = r2();

      await expect(
        service.uploadBuffer("b", "k", Buffer.alloc(0), "image/png"),
      ).rejects.toThrow("Cannot upload empty buffer");
      expect(send).not.toHaveBeenCalled();
    });

    it("puts the object with its content type and reports its size", async () => {
      const service = r2();
      const data = Buffer.from("png-bytes");

      const result = await service.uploadBuffer(
        "assets",
        "u1/a.png",
        data,
        "image/png",
      );

      const command = send.mock.calls[0]![0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: "assets",
        Key: "u1/a.png",
        Body: data,
        ContentType: "image/png",
      });
      expect(result).toEqual({
        bucket: "assets",
        key: "u1/a.png",
        size: 9,
        mimeType: "image/png",
      });
    });

    it("propagates S3 errors", async () => {
      const service = r2();
      send.mockRejectedValue(new Error("AccessDenied"));

      await expect(
        service.uploadBuffer("b", "k", Buffer.from("x"), "text/plain"),
      ).rejects.toThrow("AccessDenied");
    });
  });

  it("streams large uploads with multipart upload", async () => {
    const service = r2();
    const stream = Readable.from(["chunk"]);

    const result = await service.uploadStream(
      "backups",
      "db.dump",
      stream,
      "application/octet-stream",
    );

    expect(upload.params).toEqual({
      Bucket: "backups",
      Key: "db.dump",
      Body: stream,
      ContentType: "application/octet-stream",
    });
    expect(upload.done).toHaveBeenCalled();
    expect(result).toMatchObject({ bucket: "backups", key: "db.dump" });
  });

  describe("getPresignedDownloadUrl", () => {
    it("signs a path-style R2 URL valid for 15 minutes by default", async () => {
      const service = r2();

      const url = new URL(
        await service.getPresignedDownloadUrl("assets", "u1/pic 1.png"),
      );

      expect(url.origin).toBe("https://acct123.r2.cloudflarestorage.com");
      expect(url.pathname).toBe("/assets/u1/pic%201.png");
      expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
      expect(url.searchParams.get("X-Amz-Credential")).toMatch(/^AKIDTEST\//);
      expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
      expect(url.toString()).not.toContain("secret");
      expect(send).not.toHaveBeenCalled(); // signing is local
    });

    it("honours a custom expiry", async () => {
      const service = r2();
      const url = new URL(
        await service.getPresignedDownloadUrl("assets", "k", 3600),
      );
      expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    });
  });

  describe("delete / listObjects", () => {
    it("deletes from the default bucket unless one is given", async () => {
      const service = r2();

      await service.delete("u1/a.png");
      await service.delete("u1/b.png", "other");

      const [first, second] = send.mock.calls.map(
        (c) => (c[0] as DeleteObjectCommand).input,
      );
      expect(first).toEqual({ Bucket: "creatorhub-assets", Key: "u1/a.png" });
      expect(second).toEqual({ Bucket: "other", Key: "u1/b.png" });
    });

    it("lists objects under a prefix with safe defaults", async () => {
      const service = r2();
      const modified = new Date("2026-01-01");
      send.mockResolvedValue({
        Contents: [
          { Key: "app-backups/a.dump", Size: 100, LastModified: modified },
          { Key: "app-backups/metadata.json" },
        ],
      } as never);

      const objects = await service.listObjects("app-backups/");

      expect((send.mock.calls[0]![0] as ListObjectsCommand).input).toEqual({
        Bucket: "creatorhub-assets",
        Prefix: "app-backups/",
      });
      expect(objects[0]).toEqual({
        key: "app-backups/a.dump",
        size: 100,
        lastModified: modified,
      });
      expect(objects[1]).toMatchObject({
        key: "app-backups/metadata.json",
        size: 0,
      });
      expect(objects[1]!.lastModified).toBeInstanceOf(Date);
    });

    it("returns an empty list for an empty prefix", async () => {
      const service = r2();
      send.mockResolvedValue({} as never);
      expect(await service.listObjects("nothing/")).toEqual([]);
    });
  });
});
