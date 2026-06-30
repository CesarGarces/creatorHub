import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import type { UserContentSample } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import type { CreateSampleDto } from "../dto/create-sample.dto";

@Injectable()
export class ContentSampleService {
  private logger = new Logger("ContentSampleService");

  async create(
    userId: string,
    dto: CreateSampleDto,
  ): Promise<UserContentSample> {
    if (dto.content.trim().length < 10) {
      throw new BadRequestException(
        "Sample content must be at least 10 characters",
      );
    }

    return prisma.userContentSample.create({
      data: {
        userId,
        content: dto.content.trim(),
        source: dto.source || "MANUAL",
      },
    });
  }

  async createBulk(
    userId: string,
    samples: { content: string; source?: string }[],
  ): Promise<{ count: number }> {
    const validSamples = samples.filter((s) => s.content.trim().length >= 10);

    if (validSamples.length === 0) {
      throw new BadRequestException(
        "No valid samples provided. Each sample must be at least 10 characters.",
      );
    }

    return prisma.userContentSample.createMany({
      data: validSamples.map((s) => ({
        userId,
        content: s.content.trim(),
        source: (s.source as any) || "MANUAL",
      })),
    });
  }

  async getRecentSamples(
    userId: string,
    limit = 10,
  ): Promise<UserContentSample[]> {
    return prisma.userContentSample.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async list(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: UserContentSample[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;

    const [samples, total] = await Promise.all([
      prisma.userContentSample.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.userContentSample.count({
        where: { userId, isActive: true },
      }),
    ]);

    return {
      data: samples,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async delete(userId: string, sampleId: string): Promise<UserContentSample> {
    const sample = await prisma.userContentSample.findFirst({
      where: { id: sampleId, userId },
    });

    if (!sample) {
      throw new NotFoundException("Sample not found");
    }

    return prisma.userContentSample.delete({
      where: { id: sampleId },
    });
  }

  async count(userId: string): Promise<number> {
    return prisma.userContentSample.count({
      where: { userId, isActive: true },
    });
  }
}
