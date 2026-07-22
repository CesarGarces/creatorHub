import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { UsageTracker } from "./usage.tracker";

export interface LogUsageParams {
  userId: string;
  toolId: string;
  modelId?: string;
  providerSlug?: string;
  duration?: number;
  success: boolean;
  credits?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Centralized platform usage logger.
 *
 * Every tool/service should call `logUsage()` on completion (success or failure).
 * This service:
 * 1. Resolves human-readable names (tool name, model displayName) from DB
 * 2. Writes structured JSON log to stdout
 * 3. Writes to UsageLog table via UsageTracker
 */
@Injectable()
export class PlatformUsageLogger {
  private logger = new Logger("PlatformUsage");

  constructor(private usageTracker: UsageTracker) {}

  async logUsage(params: LogUsageParams): Promise<void> {
    const {
      userId,
      toolId,
      modelId,
      duration,
      success,
      credits,
      error,
      metadata,
    } = params;

    // Resolve human-readable names (non-blocking, best-effort)
    const [toolResult, modelName] = await Promise.all([
      this.resolveTool(toolId),
      modelId ? this.resolveModelName(modelId) : Promise.resolve(undefined),
    ]);

    const toolName = toolResult.name;
    const toolExists = toolResult.exists;

    const durationStr = duration ? `${(duration / 1000).toFixed(1)}s` : "n/a";

    // Structured JSON log
    this.logger.info(
      `${toolName ?? toolId} ${success ? "completed" : "failed"}`,
      {
        userId,
        toolId,
        toolName: toolName ?? toolId,
        modelId: modelId ?? "n/a",
        modelName: modelName ?? modelId ?? "n/a",
        duration: durationStr,
        durationMs: duration ?? null,
        success,
        credits: credits ?? 0,
        error: error ?? null,
        ...metadata,
      },
    );

    // Write to UsageLog table (best-effort, skip if tool doesn't exist in Tool table)
    if (toolExists) {
      try {
        await this.usageTracker.track({
          userId,
          toolId,
          credits: credits ?? 0,
          duration,
          success,
          error,
          metadata: {
            toolName: toolName ?? toolId,
            modelName: modelName ?? modelId ?? "n/a",
            ...metadata,
          },
        });
      } catch (err) {
        this.logger.warn("Failed to write UsageLog", {
          error: (err as Error).message,
          toolId,
          userId,
        });
      }
    }
  }

  private async resolveTool(
    toolId: string,
  ): Promise<{ name: string | null; exists: boolean }> {
    try {
      const tool = await prisma.tool.findUnique({
        where: { id: toolId },
        select: { name: true },
      });
      return { name: tool?.name ?? null, exists: !!tool };
    } catch {
      return { name: null, exists: false };
    }
  }

  private async resolveModelName(modelId: string): Promise<string | null> {
    try {
      const model = await prisma.modelMetadata.findFirst({
        where: { modelId },
        select: { displayName: true },
        orderBy: { isActive: "desc" },
      });
      return model?.displayName ?? null;
    } catch {
      return null;
    }
  }
}
