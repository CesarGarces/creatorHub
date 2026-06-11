import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class UsageTracker {
  private logger = new Logger("UsageTracker");

  constructor(@InjectQueue("analytics") private analyticsQueue: Queue) {}

  async track(params: {
    userId: string;
    toolId: string;
    credits: number;
    duration?: number;
    success?: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.analyticsQueue.add("track-usage", params);

    await prisma.usageLog.create({
      data: {
        userId: params.userId,
        toolId: params.toolId,
        credits: params.credits,
        duration: params.duration,
        success: params.success ?? true,
        error: params.error,
        metadata: params.metadata as any,
      },
    });
  }
}
