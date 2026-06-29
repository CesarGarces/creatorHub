import { Injectable } from "@nestjs/common";
import { ProviderRegistry } from "@creator-hub/ai-engine";
import { ChatRoutingService } from "./chat-routing.service";
import { ChatHistoryService } from "./chat-history.service";
import { ChatSettingsService } from "./chat-settings.service";
import { Logger } from "@creator-hub/shared-utils";
import { prisma } from "@creator-hub/database";
import { CreditService } from "@creator-hub/billing";
import { Readable } from "stream";

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class ChatService {
  private logger = new Logger("ChatService");

  constructor(
    private providerRegistry: ProviderRegistry,
    private routingService: ChatRoutingService,
    private historyService: ChatHistoryService,
    private settingsService: ChatSettingsService,
    private creditService: CreditService,
  ) {}

  async createSession(
    userId: string,
    data: {
      title?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      reasoning?: number;
    },
  ): Promise<any> {
    const settings = await this.settingsService.getSettings(userId);

    return prisma.chatSession.create({
      data: {
        userId,
        title: data.title,
        model: data.model || settings.defaultModel,
        temperature: data.temperature ?? settings.temperature,
        maxTokens: data.maxTokens ?? settings.maxTokens,
        reasoning: data.reasoning ?? settings.reasoning,
      },
    });
  }

  createMessageStream(
    sessionId: string,
    userId: string,
    body: { content: string },
  ): Readable {
    const stream = new Readable({ read() {} });

    this.handleStream(sessionId, userId, body.content, stream).catch(
      (error) => {
        this.logger.error("Stream error", { error: error.message });
        const data = JSON.stringify({
          type: "error",
          error: error.message,
        });
        stream.push(`data: ${data}\n\n`);
        stream.push(null);
      },
    );

    return stream;
  }

  private async handleStream(
    sessionId: string,
    userId: string,
    content: string,
    stream: Readable,
  ) {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const model = session.model;

      const providerRecord = await prisma.provider.findFirst({
        where: { model, isActive: true },
      });
      const creditCost = providerRecord?.costPerCredit ?? 1;

      const hasCredits = await this.creditService.hasEnoughCredits(
        userId,
        creditCost,
      );
      if (!hasCredits) {
        throw new Error(
          `Insufficient credits. This model requires ${creditCost} credits.`,
        );
      }

      const startData = JSON.stringify({
        type: "start",
        model,
        creditCost,
      });
      stream.push(`data: ${startData}\n\n`);

      await this.historyService.appendMessage(sessionId, "user", content);
      await this.historyService.updateSessionActivity(sessionId);

      const history =
        await this.historyService.getSessionMessageHistory(sessionId);
      const systemPrompt = this.routingService.buildSystemPrompt(content);

      const provider =
        this.providerRegistry.getStreamingProviderForModel(model);

      if (!provider || !provider.generateStream) {
        throw new Error(`No streaming provider available for model: ${model}`);
      }

      const conversationHistory = history.slice(0, -1);

      const aiStream = provider.generateStream({
        taskType: "text-generation",
        prompt: content,
        parameters: {
          temperature: session.temperature,
          maxTokens: session.maxTokens,
          systemPrompt,
          conversationHistory,
        },
      });

      let fullContent = "";

      for await (const chunk of aiStream) {
        if (chunk.type === "content" && chunk.content) {
          fullContent += chunk.content;
          const data = JSON.stringify({
            type: "content",
            content: chunk.content,
          });
          stream.push(`data: ${data}\n\n`);
        } else if (chunk.type === "done") {
          await this.historyService.appendMessage(
            sessionId,
            "assistant",
            fullContent,
          );

          const deducted = await this.creditService.deduct(
            userId,
            creditCost,
            "chat",
            `Chat message (${model})`,
          );

          if (!deducted) {
            this.logger.warn("Credit deduction failed after chat completion", {
              userId,
              model,
              creditCost,
            });
          }

          const data = JSON.stringify({
            type: "done",
            content: fullContent,
            creditCost,
          });
          stream.push(`data: ${data}\n\n`);
        } else if (chunk.type === "error") {
          const data = JSON.stringify({
            type: "error",
            error: chunk.error,
          });
          stream.push(`data: ${data}\n\n`);
        }
      }

      stream.push(null);
    } catch (error) {
      this.logger.error("Handle stream failed", {
        error: (error as Error).message,
      });
      const data = JSON.stringify({
        type: "error",
        error: (error as Error).message,
      });
      stream.push(`data: ${data}\n\n`);
      stream.push(null);
    }
  }

  getAvailableTools(): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    creditsPerUse: number;
    route?: string;
  }> {
    const tools = this.routingService.getActiveTools();
    return tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      creditsPerUse: tool.creditsPerUse,
      route: tool.frontend.routes[0]?.path,
    }));
  }
}
