import { Injectable } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Logger } from "@creator-hub/shared-utils";
import { Readable } from "stream";

export interface UploadResult {
  bucket: string;
  key: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class StorageService {
  private s3: S3Client;
  private defaultBucket: string;
  private endpoint: string | undefined;
  private provider: string;
  private logger = new Logger("StorageService");

  constructor() {
    this.provider = process.env.STORAGE_PROVIDER || "r2";

    if (this.provider === "r2") {
      this.endpoint = process.env.R2_ENDPOINT;
      if (!this.endpoint) {
        throw new Error(
          "R2_ENDPOINT is required when STORAGE_PROVIDER=r2. " +
            "Expected format: https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
        );
      }
      this.s3 = new S3Client({
        region: "auto",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
        },
        endpoint: this.endpoint,
        forcePathStyle: true,
      });
      this.defaultBucket = process.env.R2_BUCKET || "creatorhub-assets";
      this.logger.info("Using Cloudflare R2 storage", {
        endpoint: this.endpoint,
        bucket: this.defaultBucket,
      });
    } else if (this.provider === "minio") {
      this.endpoint = process.env.AWS_S3_ENDPOINT;
      if (!this.endpoint) {
        throw new Error(
          "AWS_S3_ENDPOINT is required when STORAGE_PROVIDER=minio",
        );
      }
      this.s3 = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
        endpoint: this.endpoint,
        forcePathStyle: true,
      });
      this.defaultBucket = process.env.AWS_S3_BUCKET || "creatorhub-assets";
      this.logger.info("Using MinIO storage");
    } else {
      this.endpoint = process.env.AWS_S3_ENDPOINT;
      this.s3 = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
        endpoint: this.endpoint,
        forcePathStyle: !!this.endpoint,
      });
      this.defaultBucket = process.env.AWS_S3_BUCKET || "creatorhub-assets";
      this.logger.info("Using AWS S3 storage");
    }
  }

  getProvider(): string {
    return this.provider;
  }

  getDefaultBucket(): string {
    return this.defaultBucket;
  }

  async uploadBuffer(
    bucket: string,
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<UploadResult> {
    if (!buffer || buffer.length === 0) {
      throw new Error("Cannot upload empty buffer");
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return {
      bucket,
      key,
      size: buffer.length,
      mimeType,
    };
  }

  async uploadStream(
    bucket: string,
    key: string,
    stream: Readable,
    mimeType: string,
  ): Promise<UploadResult> {
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: bucket,
        Key: key,
        Body: stream,
        ContentType: mimeType,
      },
    });

    await upload.done();

    return {
      bucket,
      key,
      size: 0, // Size is determined by caller via statSync before upload
      mimeType,
    };
  }

  async getPresignedDownloadUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number = 900,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string, bucket?: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: bucket || this.defaultBucket,
        Key: key,
      }),
    );
  }

  async listObjects(
    prefix: string,
    bucket?: string,
  ): Promise<{ key: string; size: number; lastModified: Date }[]> {
    const result = await this.s3.send(
      new ListObjectsCommand({
        Bucket: bucket || this.defaultBucket,
        Prefix: prefix,
      }),
    );

    return (result.Contents || []).map((item) => ({
      key: item.Key!,
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
    }));
  }
}
