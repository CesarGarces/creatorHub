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
  private logger = new Logger("StorageService");

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
      endpoint: process.env.AWS_S3_ENDPOINT,
      forcePathStyle: !!process.env.AWS_S3_ENDPOINT,
    });
    this.bucket = process.env.AWS_S3_BUCKET || "creatorhub-assets";
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

    const url = `https://${this.bucket}.s3.amazonaws.com/${key}`;

    const file = await prisma.file.create({
      data: {
        userId,
        toolId,
        originalName: fileName,
        mimeType,
        size: buffer.length,
        key,
        url,
      },
    });

    return file;
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
