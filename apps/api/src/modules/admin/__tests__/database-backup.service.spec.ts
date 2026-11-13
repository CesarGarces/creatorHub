import { EventEmitter } from "events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";

const { spawnMock, fsMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  fsMock: {
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    createReadStream: vi.fn(),
  },
}));

vi.mock("child_process", () => ({ spawn: spawnMock }));
vi.mock("fs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...fsMock,
}));

import {
  DatabaseBackupService,
  type BackupMetadata,
} from "../database-backup.service";

/** Fake pg_dump child process that exits with the given code. */
function fakePgDump(exitCode: number, stderr = "") {
  const child = Object.assign(new EventEmitter(), {
    stderr: new EventEmitter(),
  });
  setImmediate(() => {
    if (stderr) child.stderr.emit("data", Buffer.from(stderr));
    child.emit("close", exitCode);
  });
  return child;
}

describe("DatabaseBackupService", () => {
  const storage = {
    getDefaultBucket: vi.fn(() => "bucket"),
    listObjects: vi.fn(),
    getPresignedDownloadUrl: vi.fn(),
    uploadBuffer: vi.fn(),
    uploadStream: vi.fn(),
    delete: vi.fn(),
  };
  const fetchMock = vi.fn();
  let service: DatabaseBackupService;
  const envBackup = { ...process.env };

  /** Makes the stored metadata.json return `list`. */
  function givenStoredMetadata(list: BackupMetadata[]) {
    storage.listObjects.mockResolvedValue([
      { key: "app-backups/metadata.json" },
    ]);
    storage.getPresignedDownloadUrl.mockResolvedValue("https://meta");
    fetchMock.mockResolvedValue({ ok: true, json: async () => list });
  }

  /** Metadata lists written back to storage, parsed. */
  function savedMetadata(): BackupMetadata[][] {
    return storage.uploadBuffer.mock.calls
      .filter((c) => c[1] === "app-backups/metadata.json")
      .map((c) => JSON.parse((c[2] as Buffer).toString()));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    service = new DatabaseBackupService(storage as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...envBackup };
  });

  const existing: BackupMetadata = {
    id: "backup_1",
    filename: "old.dump",
    key: "app-backups/old.dump",
    size: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    database: "creatorhub",
    environment: "development",
    status: "completed",
  };

  describe("listBackups", () => {
    it("returns an empty list when no metadata file exists", async () => {
      storage.listObjects.mockResolvedValue([]);
      expect(await service.listBackups()).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns an empty list when the metadata download fails", async () => {
      storage.listObjects.mockResolvedValue([
        { key: "app-backups/metadata.json" },
      ]);
      storage.getPresignedDownloadUrl.mockResolvedValue("https://meta");
      fetchMock.mockResolvedValue({ ok: false });

      expect(await service.listBackups()).toEqual([]);
    });

    it("returns the stored metadata", async () => {
      givenStoredMetadata([existing]);
      expect(await service.listBackups()).toEqual([existing]);
    });
  });

  describe("createBackup", () => {
    it("fails fast when no database URL is configured", async () => {
      delete process.env.DATABASE_URL;
      delete process.env.DATABASE_URL_DEV;
      process.env.NODE_ENV = "development";

      await expect(service.createBackup()).rejects.toThrow(BadRequestException);
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it("runs pg_dump without a shell and passes the password only via env", async () => {
      process.env.NODE_ENV = "production";
      process.env.DATABASE_URL_PROD =
        "postgresql://admin:s3cr3t@db.example.com:6543/creatorhub";
      givenStoredMetadata([existing]);
      spawnMock.mockImplementation(() => fakePgDump(0));
      fsMock.statSync.mockReturnValue({ size: 2048 });
      fsMock.createReadStream.mockReturnValue("stream");

      const entry = await service.createBackup();

      const [cmd, args, options] = spawnMock.mock.calls[0]!;
      expect(cmd).toBe("pg_dump");
      expect(args).toEqual(
        expect.arrayContaining([
          "-h",
          "db.example.com",
          "-p",
          "6543",
          "-U",
          "admin",
          "-d",
          "creatorhub",
        ]),
      );
      expect(args.join(" ")).not.toContain("s3cr3t");
      expect(options.shell).toBeUndefined();
      expect(options.env.PGPASSWORD).toBe("s3cr3t");
      expect(options.env.PGSSLMODE).toBe("require");

      expect(storage.uploadStream).toHaveBeenCalledWith(
        "bucket",
        entry.key,
        "stream",
        "application/octet-stream",
      );
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(`/tmp/${entry.filename}`);
      expect(entry).toMatchObject({
        status: "completed",
        size: 2048,
        database: "creatorhub",
        environment: "production",
      });

      // Metadata is written twice: "in-progress" first, then the final state.
      const [first, last] = savedMetadata();
      expect(first![0]!.status).toBe("in-progress");
      expect(last!.map((b) => b.id)).toEqual([entry.id, existing.id]);
      expect(last![0]!.status).toBe("completed");
    });

    it("records a failed backup and scrubs passwords from the error", async () => {
      process.env.NODE_ENV = "development";
      process.env.DATABASE_URL = "postgresql://u:pw@localhost/app";
      givenStoredMetadata([]);
      spawnMock.mockImplementation(() =>
        fakePgDump(1, "connection failed PGPASSWORD=pw host=localhost"),
      );

      const entry = await service.createBackup();

      expect(entry.status).toBe("failed");
      expect(entry.error).toContain("PGPASSWORD=***");
      expect(entry.error).not.toContain("PGPASSWORD=pw");
      expect(storage.uploadStream).not.toHaveBeenCalled();
      expect(spawnMock.mock.calls[0]![2].env.PGSSLMODE).toBeUndefined();
      expect(savedMetadata().at(-1)![0]!.status).toBe("failed");
    });

    it("records a failure when pg_dump cannot be spawned", async () => {
      process.env.DATABASE_URL = "postgresql://u:pw@localhost/app";
      givenStoredMetadata([]);
      spawnMock.mockImplementation(() => {
        const child = Object.assign(new EventEmitter(), {
          stderr: new EventEmitter(),
        });
        setImmediate(() => child.emit("error", new Error("ENOENT")));
        return child;
      });

      const entry = await service.createBackup();

      expect(entry.status).toBe("failed");
      expect(entry.error).toBe("Failed to spawn pg_dump: ENOENT");
    });
  });

  describe("deleteBackup / getBackupDownloadUrl", () => {
    it("throws NotFound for an unknown backup id", async () => {
      givenStoredMetadata([existing]);

      await expect(service.deleteBackup("nope")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getBackupDownloadUrl("nope")).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it("deletes the dump file and removes it from the metadata", async () => {
      givenStoredMetadata([existing]);

      await service.deleteBackup("backup_1");

      expect(storage.delete).toHaveBeenCalledWith(
        "app-backups/old.dump",
        "bucket",
      );
      expect(savedMetadata().at(-1)).toEqual([]);
    });

    it("returns a one-hour presigned URL for a backup", async () => {
      givenStoredMetadata([existing]);
      storage.getPresignedDownloadUrl
        .mockResolvedValueOnce("https://meta")
        .mockResolvedValueOnce("https://dump");

      expect(await service.getBackupDownloadUrl("backup_1")).toBe(
        "https://dump",
      );
      expect(storage.getPresignedDownloadUrl).toHaveBeenLastCalledWith(
        "bucket",
        "app-backups/old.dump",
        3600,
      );
    });
  });
});
