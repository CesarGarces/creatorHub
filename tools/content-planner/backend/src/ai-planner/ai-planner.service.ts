import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, type ContentAiPlan, type Prisma } from "@creator-hub/database";
import {
  EmbeddingService,
  ProviderRegistry,
  topKBySimilarity,
  type ResolvedEmbedder,
} from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { PlatformUsageLogger } from "@creator-hub/analytics";
import { ToolRegistry } from "@creator-hub/tool-sdk";
import { Logger } from "@creator-hub/shared-utils";
import type { AIRequest } from "@creator-hub/shared-types";
import { chunkText } from "./chunking";
import {
  extractDocument,
  type ExtractedDocument,
  type UploadedPlanFile,
} from "./document-extractor";
import {
  KnowledgeIndexService,
  type ProjectDigest,
} from "./knowledge-index.service";
import {
  buildPlanningPrompt,
  countWords,
  heuristicComplexity,
  mentionedTools,
  parsePlanResponse,
  PlanParseError,
} from "./planning-prompt";
import type {
  AiPlanResult,
  AvailableTool,
  ComplexitySignals,
  PlanLanguage,
  SimilarProduction,
} from "./ai-plan.types";

export const PLANNER_TOOL_ID = "content-planner";
/** Characters of brief (idea + voice + documents) sent to the model. */
export const CONTEXT_BUDGET_CHARS = 12_000;
const TEXT_TASK = "text-generation";

export type PlanningStage =
  | "reading"
  | "indexing"
  | "retrieving"
  | "analyzing"
  | "saving";

export type PlanningEvent =
  | { type: "stage"; stage: PlanningStage }
  | {
      type: "done";
      planId: string;
      plan: AiPlanResult;
      creditsCharged: number;
    };

export interface AnalyzeInput {
  userId: string;
  modelId: string;
  idea?: string;
  transcript?: string;
  platform?: string;
  publishDate?: string;
  language: PlanLanguage;
  files: UploadedPlanFile[];
  /** Aborted when the client disconnects: nothing is charged or saved. */
  signal?: AbortSignal;
  onEvent?: (event: PlanningEvent) => void;
}

export interface PlanEstimate {
  modelId: string;
  modelName: string;
  modelCost: number;
  embeddingModel: string;
  embeddingCost: number;
  total: number;
}

export class PlanningAbortedError extends Error {
  constructor() {
    super("Planning cancelled");
  }
}

interface ResolvedModel {
  modelId: string;
  displayName: string;
  creditCost: number;
  tier: "FREE" | "PRO";
}

/**
 * The AI planning assistant: turns an idea (text, voice transcript and/or
 * documents) into a scheduled production plan, using the vector RAG index
 * of the user's past productions to estimate steps and timeframes, and the
 * Tool Registry to suggest which platform tools each step should use.
 *
 * Credits: the selected text model's creditCost (+ the embedding model's
 * when a remote one is configured) — both set in Admin → AI Models —
 * checked before any work, charged through CreditService after success.
 */
@Injectable()
export class AiPlannerService {
  private readonly logger = new Logger("AiPlannerService");

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly embeddings: EmbeddingService,
    private readonly credits: CreditService,
    private readonly usage: PlatformUsageLogger,
    private readonly tools: ToolRegistry,
    private readonly knowledge: KnowledgeIndexService,
  ) {}

  async estimate(userId: string, modelId: string): Promise<PlanEstimate> {
    const model = await this.resolveModel(userId, modelId);
    const embedder = await this.embeddings.resolve();
    const embeddingCost = embedder.remote ? embedder.creditCost : 0;
    return {
      modelId: model.modelId,
      modelName: model.displayName,
      modelCost: model.creditCost,
      embeddingModel: embedder.displayName,
      embeddingCost,
      total: model.creditCost + embeddingCost,
    };
  }

  async analyze(input: AnalyzeInput): Promise<{
    planId: string;
    plan: AiPlanResult;
    creditsCharged: number;
  }> {
    const started = Date.now();
    const emit = (event: PlanningEvent) => input.onEvent?.(event);
    const checkAborted = () => {
      if (input.signal?.aborted) throw new PlanningAbortedError();
    };
    const idea = (input.idea ?? "").trim();
    const transcript = (input.transcript ?? "").trim();
    if (idea.length + transcript.length < 10 && input.files.length === 0) {
      throw new BadRequestException(
        "Describe your idea, record it or attach a file (at least 10 characters)",
      );
    }

    const model = await this.resolveModel(input.userId, input.modelId);
    const provider =
      (await this.providers.getProviderForModel(model.modelId)) ??
      this.providers.getAnyProviderForTask(TEXT_TASK);
    if (!provider)
      throw new BadRequestException("Selected provider is not available");

    const embedder = await this.embeddings.resolve();
    const cost = model.creditCost + (embedder.remote ? embedder.creditCost : 0);
    if (!(await this.credits.hasEnoughCredits(input.userId, cost))) {
      throw new BadRequestException(
        `Insufficient credits. This plan requires ${cost} credits.`,
      );
    }

    try {
      // 1. Documents → text
      emit({ type: "stage", stage: "reading" });
      const documents = await Promise.all(input.files.map(extractDocument));
      checkAborted();

      // 2. Vector index of past productions
      emit({ type: "stage", stage: "indexing" });
      const { digests } = await this.knowledge.syncProjectHistory(
        input.userId,
        embedder,
      );
      checkAborted();

      // 3. Retrieval: similar productions + the most relevant excerpts
      emit({ type: "stage", stage: "retrieving" });
      // What the video is about: the idea first, then the opening of each
      // file (long bodies would drown the topic words).
      const query = [
        idea,
        transcript,
        ...documents.map((d) => d.text.slice(0, 300)),
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1200);
      const [queryVector] = await embedder.embed([query]);
      const similar = await this.similarProductions(
        input.userId,
        embedder,
        queryVector!,
        digests,
      );
      const excerpts = await this.selectExcerpts(
        documents,
        idea.length + transcript.length,
        queryVector!,
        embedder,
      );
      checkAborted();

      // 4. Complexity signals + the model
      emit({ type: "stage", stage: "analyzing" });
      const availableTools = this.availableTools();
      const allText = [idea, transcript, ...documents.map((d) => d.text)].join(
        "\n",
      );
      const mentioned = mentionedTools(allText, availableTools);
      const historyAverageMinutes = similar.length
        ? Math.round(
            similar.reduce((s, p) => s + p.totalMinutes, 0) / similar.length,
          )
        : null;
      const signals: ComplexitySignals = {
        inputWords: countWords(allText),
        sources: [idea, transcript].filter(Boolean).length + documents.length,
        excerpts: excerpts.length,
        similarProductions: similar.length,
        historyAverageMinutes,
        mentionedTools: mentioned,
        heuristicScore: heuristicComplexity({
          inputWords: countWords(allText),
          sources: [idea, transcript].filter(Boolean).length + documents.length,
          mentionedTools: mentioned.length,
          historyAverageMinutes,
        }),
      };
      const prompt = buildPlanningPrompt({
        language: input.language,
        idea,
        transcript,
        excerpts,
        platform: input.platform ?? null,
        publishDate: input.publishDate ?? null,
        tools: availableTools,
        signals,
        similar: similar.map((s) => ({
          ...s,
          digest: digests.get(s.projectId)?.text ?? "",
        })),
      });
      const response = await provider.generate({
        taskType: TEXT_TASK,
        // DB-driven model id; `AIModel` is a legacy union of built-in names
        // and providers read `request.model` as a plain string.
        model: model.modelId as AIRequest["model"],
        prompt,
        parameters: { temperature: 0.3, maxTokens: 3000 },
        userId: input.userId,
        toolId: PLANNER_TOOL_ID,
      });
      checkAborted();
      const output = response.output as { content?: string };

      let parsed;
      try {
        parsed = parsePlanResponse(output?.content ?? "", {
          tools: availableTools,
          heuristicScore: signals.heuristicScore,
          fallbackTitle: (
            idea ||
            transcript ||
            documents[0]?.name ||
            "Video"
          ).slice(0, 80),
        });
      } catch (error) {
        if (error instanceof PlanParseError) {
          throw new BadRequestException(
            "The model didn't return a valid plan. Try again or choose another model.",
          );
        }
        throw error;
      }

      const plan: AiPlanResult = {
        ...parsed,
        platform: parsed.platform ?? input.platform ?? null,
        signals,
        totalMinutes: parsed.steps.reduce(
          (sum, s) => sum + s.durationMinutes,
          0,
        ),
        historyEstimateMinutes: historyAverageMinutes,
        similarProductions: similar,
        sources: documents.map((d) => ({
          name: d.name,
          kind: d.kind,
          chars: d.text.length,
          truncated: d.truncated,
        })),
        model: { id: model.modelId, name: model.displayName },
        embeddingModel: embedder.modelKey,
      };

      // 5. Save, then charge (the row is removed if the charge fails).
      emit({ type: "stage", stage: "saving" });
      const saved = await prisma.contentAiPlan.create({
        data: {
          userId: input.userId,
          modelId: model.modelId,
          title: plan.title,
          complexity: plan.complexity.level,
          result: plan as unknown as Prisma.InputJsonValue,
          inputSummary: {
            ideaChars: idea.length,
            transcriptChars: transcript.length,
            files: documents.map((d) => d.name),
          },
          creditsCharged: cost,
        },
      });
      const charged =
        cost === 0 ||
        (await this.credits.deduct(
          input.userId,
          cost,
          PLANNER_TOOL_ID,
          `AI plan: ${plan.title.slice(0, 50)}`,
        ));
      if (!charged) {
        try {
          await prisma.contentAiPlan.delete({ where: { id: saved.id } });
        } catch {
          // Already gone: nothing to undo.
        }
        throw new BadRequestException(
          `Insufficient credits. This plan requires ${cost} credits.`,
        );
      }

      await this.usage.logUsage({
        userId: input.userId,
        toolId: PLANNER_TOOL_ID,
        modelId: model.modelId,
        duration: Date.now() - started,
        success: true,
        credits: cost,
        metadata: {
          planId: saved.id,
          complexity: plan.complexity.level,
          steps: plan.steps.length,
          files: documents.length,
          embeddingModel: embedder.modelKey,
          similarProductions: similar.length,
        },
      });
      this.logger.info("AI plan created", {
        userId: input.userId,
        planId: saved.id,
        credits: cost,
      });
      emit({ type: "done", planId: saved.id, plan, creditsCharged: cost });
      return { planId: saved.id, plan, creditsCharged: cost };
    } catch (error) {
      await this.usage
        .logUsage({
          userId: input.userId,
          toolId: PLANNER_TOOL_ID,
          modelId: model.modelId,
          duration: Date.now() - started,
          success: false,
          credits: 0,
          error: (error as Error).message,
        })
        .catch(() => undefined);
      throw error;
    }
  }

  async getPlan(userId: string, planId: string): Promise<ContentAiPlan> {
    const plan = await prisma.contentAiPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) throw new NotFoundException("AI plan not found");
    return plan;
  }

  /** Active platform tools the assistant may suggest (not the planner itself). */
  availableTools(): AvailableTool[] {
    return this.tools
      .getActive()
      .filter((t) => t.id !== PLANNER_TOOL_ID)
      .map((t) => ({ id: t.id, name: t.name, description: t.description }));
  }

  private async resolveModel(
    userId: string,
    modelId: string,
  ): Promise<ResolvedModel> {
    const model = await prisma.modelMetadata.findFirst({
      where: { modelId, isActive: true, taskType: TEXT_TASK },
      select: {
        modelId: true,
        displayName: true,
        creditCost: true,
        tier: true,
      },
    });
    if (!model)
      throw new BadRequestException("Selected provider is not available");
    if (model.tier === "PRO") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      if (!user || user.plan === "FREE") {
        throw new ForbiddenException(
          "This provider is only available on paid plans. Please upgrade.",
        );
      }
    }
    return model;
  }

  private async similarProductions(
    userId: string,
    embedder: ResolvedEmbedder,
    query: number[],
    digests: Map<string, ProjectDigest>,
  ): Promise<SimilarProduction[]> {
    const hits = await this.knowledge.findSimilarProjects(
      userId,
      embedder,
      query,
    );
    return hits.flatMap((hit) => {
      const digest = digests.get(hit.projectId);
      return digest
        ? [
            {
              projectId: digest.projectId,
              title: digest.title,
              similarity: Math.round(hit.score * 100) / 100,
              totalMinutes: digest.totalMinutes,
              sessions: digest.sessions,
            },
          ]
        : [];
    });
  }

  /**
   * Document text for the prompt. Everything when it fits the budget;
   * otherwise the chunks most similar to the idea (vector retrieval), kept
   * in their original order.
   */
  private async selectExcerpts(
    documents: ExtractedDocument[],
    usedChars: number,
    query: number[],
    embedder: ResolvedEmbedder,
  ): Promise<{ source: string; text: string }[]> {
    const budget = Math.max(2_000, CONTEXT_BUDGET_CHARS - usedChars);
    const total = documents.reduce((s, d) => s + d.text.length, 0);
    if (total <= budget) {
      return documents.map((d) => ({ source: d.name, text: d.text }));
    }
    const chunks = documents.flatMap((d) =>
      chunkText(d.text).map((text, index) => ({ source: d.name, text, index })),
    );
    const vectors = await embedder.embed(chunks.map((c) => c.text));
    const ranked = topKBySimilarity(
      query,
      chunks.map((c, i) => ({ ...c, order: i, vector: vectors[i]! })),
      (c) => c.vector,
      chunks.length,
      -1,
    );
    const picked: typeof ranked = [];
    let used = 0;
    for (const r of ranked) {
      if (used + r.item.text.length > budget) continue;
      picked.push(r);
      used += r.item.text.length;
    }
    return picked
      .sort((a, b) => a.item.order - b.item.order)
      .map((r) => ({ source: r.item.source, text: r.item.text }));
  }
}
