import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { StorageService } from "@creator-hub/storage";
import { spawn } from "child_process";
import { statSync, unlinkSync, createReadStream } from "fs";

export interface BackupMetadata {
  id: string;
  filename: string;
  key: string;
  size: number;
  createdAt: string;
  database: string;
  environment: "development" | "production";
  status: "completed" | "failed" | "in-progress";
  error?: string;
}

@Injectable()
export class DatabaseBackupService {
  private readonly backupPrefix = "app-backups/";

  constructor(private readonly storage: StorageService) {}

  private async getBackupMetadataList(): Promise<BackupMetadata[]> {
    const objects = await this.storage.listObjects(
      this.backupPrefix,
      this.storage.getDefaultBucket(),
    );
    const metadataObj = objects.find((o) => o.key.endsWith("metadata.json"));
    if (!metadataObj) return [];

    const url = await this.storage.getPresignedDownloadUrl(
      this.storage.getDefaultBucket(),
      metadataObj.key,
      60,
    );
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  }

  private async saveBackupMetadataList(list: BackupMetadata[]): Promise<void> {
    const buffer = Buffer.from(JSON.stringify(list, null, 2));
    await this.storage.uploadBuffer(
      this.storage.getDefaultBucket(),
      `${this.backupPrefix}metadata.json`,
      buffer,
      "application/json",
    );
  }

  async listBackups(): Promise<BackupMetadata[]> {
    return this.getBackupMetadataList();
  }

  async createBackup(): Promise<BackupMetadata> {
    const nodeEnv = process.env.NODE_ENV || "development";
    const databaseUrl =
      nodeEnv === "production"
        ? process.env.DATABASE_URL_PROD || process.env.DATABASE_URL
        : process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new BadRequestException(
        `DATABASE_URL not configured for environment: ${nodeEnv}`,
      );
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `creatorhub_${dateStr}.dump`;
    const key = `${this.backupPrefix}${filename}`;

    const backupId = `backup_${now.getTime()}`;
    const urlObj = new URL(databaseUrl);
    const database =
      urlObj.pathname.replace(/^\//, "").split("?")[0] || "unknown";

    const entry: BackupMetadata = {
      id: backupId,
      filename,
      key,
      size: 0,
      createdAt: now.toISOString(),
      database,
      environment: nodeEnv === "production" ? "production" : "development",
      status: "in-progress",
    };

    const list = await this.getBackupMetadataList();
    list.unshift(entry);
    await this.saveBackupMetadataList(list);

    try {
      const tmpPath = `/tmp/${filename}`;
      const host = urlObj.hostname;
      const port = urlObj.port || "5432";
      const user = urlObj.username;
      const password = urlObj.password || "";

      // Use spawn with env vars to avoid shell injection
      await this.runPgDump({
        host,
        port,
        user,
        password,
        database,
        outputPath: tmpPath,
        useSsl: nodeEnv === "production",
      });

      const fileSize = statSync(tmpPath).size;

      // Use streaming upload to avoid loading entire file into memory
      const fileStream = createReadStream(tmpPath);
      await this.storage.uploadStream(
        this.storage.getDefaultBucket(),
        key,
        fileStream,
        "application/octet-stream",
      );

      unlinkSync(tmpPath);

      entry.size = fileSize;
      entry.status = "completed";
    } catch (error: any) {
      entry.status = "failed";
      // Sanitize error message to prevent password leaks
      entry.error = this.sanitizeErrorMessage(error.message || "Unknown error");
    }

    const idx = list.findIndex((b) => b.id === backupId);
    if (idx !== -1) list[idx] = entry;
    await this.saveBackupMetadataList(list);

    return entry;
  }

  private async runPgDump(params: {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
    outputPath: string;
    useSsl: boolean;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        "-h",
        params.host,
        "-p",
        params.port,
        "-U",
        params.user,
        "-d",
        params.database,
        "-F",
        "c",
        "--no-owner",
        "--no-acl",
        "-f",
        params.outputPath,
      ];

      const child = spawn("pg_dump", args, {
        env: {
          ...process.env,
          PGPASSWORD: params.password,
          ...(params.useSsl && { PGSSLMODE: "require" }),
        },
        timeout: 300000,
      });

      let stderr = "";

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        reject(new Error(`Failed to spawn pg_dump: ${error.message}`));
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
        }
      });
    });
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove any PGPASSWORD values from error messages
    return message.replace(/PGPASSWORD=[^\s]+/g, "PGPASSWORD=***");
  }

  async deleteBackup(id: string): Promise<void> {
    const list = await this.getBackupMetadataList();
    const idx = list.findIndex((b) => b.id === id);
    if (idx === -1) throw new NotFoundException("Backup not found");

    const backup = list[idx]!;
    await this.storage.delete(backup.key, this.storage.getDefaultBucket());

    list.splice(idx, 1);
    await this.saveBackupMetadataList(list);
  }

  async getBackupDownloadUrl(id: string): Promise<string> {
    const list = await this.getBackupMetadataList();
    const backup = list.find((b) => b.id === id);
    if (!backup) throw new NotFoundException("Backup not found");

    return this.storage.getPresignedDownloadUrl(
      this.storage.getDefaultBucket(),
      backup.key,
      3600,
    );
  }
}
