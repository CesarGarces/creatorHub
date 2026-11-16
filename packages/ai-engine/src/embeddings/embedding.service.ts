import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import type {
  EmbeddingProviderInterface,
  ResolvedEmbedder,
} from "./embedding-provider.interface";
import {
  LOCAL_EMBEDDING_MIN_SIMILARITY,
  LOCAL_EMBEDDING_MODEL,
  LocalHashEmbeddingProvider,
} from "./local-hash-embedding.provider";
import { SiliconFlowEmbeddingProvider } from "./siliconflow-embedding.provider";

/** ModelMetadata.taskType of embedding models (set by admins in "AI Models"). */
export const EMBEDDING_TASK_TYPE = "embedding";

/** Relatedness threshold for semantic (remote) embedding models. */
export const REMOTE_EMBEDDING_MIN_SIMILARITY = 0.5;

/**
 * Picks the embedder for RAG: the admin-activated "embedding" model when its
 * provider is available (its creditCost is what a run costs), otherwise the
 * free local hashing embedder. Never fails because of configuration.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger("EmbeddingService");
  private readonly local = new LocalHashEmbeddingProvider();
  private readonly remote = new Map<string, EmbeddingProviderInterface>();

  constructor() {
    this.registerProvider(new SiliconFlowEmbeddingProvider());
  }

  registerProvider(provider: EmbeddingProviderInterface): void {
    this.remote.set(provider.slug, provider);
  }

  async resolve(): Promise<ResolvedEmbedder> {
    const model = await prisma.modelMetadata.findFirst({
      where: { taskType: EMBEDDING_TASK_TYPE, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (model) {
      const provider = this.remote.get(model.providerSlug);
      if (provider?.isAvailable()) {
        return {
          modelKey: `${model.providerSlug}:${model.modelId}`,
          displayName: model.displayName,
          creditCost: model.creditCost,
          remote: true,
          minSimilarity: REMOTE_EMBEDDING_MIN_SIMILARITY,
          embed: (texts) => provider.embed(model.modelId, texts),
        };
      }
      this.logger.warn(
        "Embedding model configured but provider unavailable; using local embedder",
        {
          providerSlug: model.providerSlug,
          modelId: model.modelId,
        },
      );
    }
    return this.localEmbedder();
  }

  localEmbedder(): ResolvedEmbedder {
    return {
      modelKey: LOCAL_EMBEDDING_MODEL,
      displayName: "Local (hashing)",
      creditCost: 0,
      remote: false,
      minSimilarity: LOCAL_EMBEDDING_MIN_SIMILARITY,
      embed: (texts) => this.local.embed(texts),
    };
  }
}
