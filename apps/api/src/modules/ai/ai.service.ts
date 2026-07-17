import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";

export interface ModelResponse {
  id: string;
  providerSlug: string;
  modelId: string;
  displayName: string;
  taskType: string;
  tier: string;
  creditCost: number;
  isActive: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  description: string | null;
  tags: string[];
}

export interface ProviderResponse {
  id: string;
  name: string;
  displayName: string;
  tier: string;
  costPerCredit: number;
  model: string;
  supportedTasks: string[];
  modes: string[];
}

@Injectable()
export class AIService {
  /**
   * Legacy method — returns providers with modes.
   * Kept for backward compatibility.
   */
  async getActiveProviders(): Promise<ProviderResponse[]> {
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
      orderBy: [{ tier: "asc" }, { costPerCredit: "asc" }, { name: "asc" }],
      include: {
        modes: {
          include: { mode: true },
        },
      },
    });

    return providers.map((p) => ({
      id: p.slug,
      name: p.name,
      displayName: p.name,
      tier: p.tier === "PRO" ? "pro" : "free",
      costPerCredit: p.costPerCredit,
      model: p.model,
      supportedTasks: p.supportedTasks,
      modes: p.modes.filter((pm) => pm.mode.isActive).map((pm) => pm.mode.slug),
    }));
  }

  /**
   * Returns active models filtered by taskType(s).
   * Used by ProviderSelect to show only models matching the tool's modes.
   *
   * @param taskTypes - comma-separated list (e.g. "image-generation,text-generation")
   */
  async getActiveModels(taskTypes?: string): Promise<ModelResponse[]> {
    const taskTypeList = taskTypes
      ? taskTypes
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const where: Record<string, unknown> = { isActive: true };
    if (taskTypeList.length > 0) {
      where.taskType = { in: taskTypeList };
    }

    const models = await prisma.modelMetadata.findMany({
      where,
      orderBy: [{ tier: "asc" }, { taskType: "asc" }, { displayName: "asc" }],
    });

    return models.map((m) => ({
      id: m.id,
      providerSlug: m.providerSlug,
      modelId: m.modelId,
      displayName: m.displayName,
      taskType: m.taskType,
      tier: m.tier === "PRO" ? "pro" : "free",
      creditCost: m.creditCost,
      isActive: m.isActive,
      supportsStreaming: m.supportsStreaming,
      supportsVision: m.supportsVision,
      description: m.description,
      tags: m.tags,
    }));
  }
}
