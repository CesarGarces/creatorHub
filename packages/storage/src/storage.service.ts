import { Injectable } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucket: string;
  private endpoint: string | undefined;
  private provider: string;
  private logger = new Logger("StorageService");

  constructor() {
    this.provider = process.env.STORAGE_PROVIDER || "r2";

    if (this.provider === "r2") {
      this.endpoint = process.env.R2_ENDPOINT;
      this.s3 = new S3Client({
        region: "auto",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
        },
        endpoint: this.endpoint,
        forcePathStyle: true,
      });
      this.bucket = process.env.R2_BUCKET || "creatorhub-assets";
      this.logger.info("Using Cloudflare R2 storage");
    } else if (this.provider === "minio") {
      this.endpoint = process.env.AWS_S3_ENDPOINT;
      this.s3 = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
        endpoint: this.endpoint,
        forcePathStyle: true,
      });
      this.bucket = process.env.AWS_S3_BUCKET || "creatorhub-assets";
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
      this.bucket = process.env.AWS_S3_BUCKET || "creatorhub-assets";
      this.logger.info("Using AWS S3 storage");
    }
  }

  getProvider(): string {
    return this.provider;
  }

  async upload(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    userId?: string,
    toolId?: string
  ): Promise<any> {
    const key = `${userId || "anonymous"}/${Date.now()}-${fileName}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const directUrl = this.endpoint
      ? `${this.endpoint}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    const signedUrl = await this.getSignedUrl(key, 7 * 24 * 60 * 60);

    const file = await prisma.file.create({
      data: {
        userId,
        toolId,
        originalName: fileName,
        mimeType,
        size: buffer.length,
        key,
        url: directUrl,
      },
    });

    return { ...file, signedUrl };
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async delete(key: string) {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    await prisma.file.deleteMany({ where: { key } });
  }
}
