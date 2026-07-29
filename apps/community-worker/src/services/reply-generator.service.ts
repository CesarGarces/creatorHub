import { Inject, Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { AIEngineService } from "@creator-hub/ai-engine";
import { StyleContextService } from "@creator-hub/community-bot";
import type { AIModel } from "@creator-hub/shared-types";

interface GenerateReplyInput {
  userId: string;
  conversationId: string;
  incomingText: string;
  config: {
    modelId: string;
    temperature: number;
    maxTokens: number;
    historyLength: number;
    useStyleProfile: boolean;
    systemPromptExtra: string | null;
  };
}

export interface GeneratedReply {
  text: string;
  modelId: string;
  tokensUsed?: number;
}

/**
 * Builds the full context (style-profile RAG + conversation history) and
 * calls the AI engine with the creator's configured chat model.
 */
@Injectable()
export class ReplyGeneratorService {
  constructor(
    @Inject(AIEngineService) private readonly aiEngine: AIEngineService,
    @Inject(StyleContextService)
    private readonly styleContext: StyleContextService,
  ) {}

  async generate(input: GenerateReplyInput): Promise<GeneratedReply> {
    const { userId, conversationId, incomingText, config } = input;

    const [systemPrompt, history] = await Promise.all([
      this.styleContext.buildSystemPrompt({
        userId,
        useStyleProfile: config.useStyleProfile,
        systemPromptExtra: config.systemPromptExtra,
      }),
      this.loadHistory(conversationId, config.historyLength),
    ]);

    const response = await this.aiEngine.execute({
      taskType: "text-generation",
      model: config.modelId as AIModel,
      prompt: incomingText,
      parameters: {
        systemPrompt,
        history,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
      userId,
    });

    if (response.output.type !== "text" || !response.output.content.trim()) {
      throw new Error(
        `AI provider returned a non-text or empty reply (type: ${response.output.type})`,
      );
    }

    return {
      text: response.output.content.trim(),
      modelId: response.model || config.modelId,
      tokensUsed: response.usage.tokens,
    };
  }

  /**
   * Last N messages of the conversation mapped to chat roles: INBOUND is
   * the fan ("user"), OUTBOUND is the bot ("assistant"). Oldest first.
   */
  private async loadHistory(
    conversationId: string,
    historyLength: number,
  ): Promise<Array<{ role: string; content: string }>> {
    if (historyLength <= 0) return [];

    const messages = await prisma.communityMessage.findMany({
      where: {
        conversationId,
        status: { in: ["RECEIVED", "PROCESSING", "SENT"] },
      },
      orderBy: { createdAt: "desc" },
      take: historyLength,
      select: { direction: true, content: true },
    });

    return messages.reverse().map((m: (typeof messages)[number]) => ({
      role:
        m.direction === "INBOUND" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));
  }
}
