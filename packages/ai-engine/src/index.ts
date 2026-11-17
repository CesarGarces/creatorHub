// Modules
export { AIEngineModule } from "./ai-engine.module";

// Services
export { AIEngineService } from "./ai-engine.service";

// Providers
export { ProviderRegistry } from "./providers/provider-registry";
export { ProviderFactory } from "./providers/provider-factory";
export { OpenRouterProvider } from "./providers/openrouter.provider";

// Gateways
export { GatewayFactory } from "./gateways/gateway-factory";
export { OpenRouterGateway } from "./gateways/openrouter.gateway";
export { SiliconFlowGateway } from "./gateways/siliconflow.gateway";

// Models
export { OpenRouterModelsService } from "./models/openrouter-models.service";
export { ModelRegistryService } from "./models/model-registry.service";
export { ModelSyncService } from "./models/model-sync.service";

// Types
export type { AIProviderInterface } from "./providers/provider.interface";
export type { ImageGenerationOptions } from "./providers/provider.interface";
export type {
  AIGatewayInterface,
  GatewayType,
  GatewayConfig,
  GatewayResponse,
  ModelInfo,
  RateLimitInfo,
} from "./gateways/ai-gateway.interface";

// Embeddings (vector RAG)
export {
  EmbeddingService,
  EMBEDDING_TASK_TYPE,
  REMOTE_EMBEDDING_MIN_SIMILARITY,
} from "./embeddings/embedding.service";
export {
  LocalHashEmbeddingProvider,
  LOCAL_EMBEDDING_MODEL,
  LOCAL_EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_MIN_SIMILARITY,
} from "./embeddings/local-hash-embedding.provider";
export { SiliconFlowEmbeddingProvider } from "./embeddings/siliconflow-embedding.provider";
export type {
  EmbeddingProviderInterface,
  ResolvedEmbedder,
} from "./embeddings/embedding-provider.interface";
export {
  cosineSimilarity,
  normalize,
  topKBySimilarity,
  type Scored,
} from "./embeddings/vector-math";

// Multimodal (vision) input
export { buildUserMessageContent } from "./providers/message-content";
