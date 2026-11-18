import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { ProviderRegistry } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { PlatformUsageLogger } from "@creator-hub/analytics";
import { TTSEngineService } from "@creator-hub/tts-engine";
import { ToolRegistry } from "@creator-hub/tool-sdk";
import { Logger } from "@creator-hub/shared-utils";
import type {
  AIRequest,
  TTSAudio,
  TTSLanguage,
  VoiceAssistantEvent,
  VoiceAssistantMessage,
  VoiceConversationDetail,
  VoiceConversationSummary,
} from "@creator-hub/shared-types";
import { resolveReplyLanguage } from "./language";
import { buildPersonaPrompt } from "./persona-prompt";
import { replyCredits } from "./pricing";
import { SpeechChunker } from "./speech-text";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  MAX_TITLE_CHARS,
  TEXT_TASK,
  VOICE_ASSISTANT_HISTORY_MESSAGES,
  VOICE_ASSISTANT_NAME,
  VOICE_ASSISTANT_REPLY_CREDITS,
  VOICE_ASSISTANT_TOOL_ID,
} from "./voice-assistant.constants";

export interface ReplyInput {
  userId: string;
  conversationId?: string;
  content: string;
  spoken: boolean;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  languageHint?: TTSLanguage;
  /** Aborted when the client leaves (closed stream, barge-in). */
  signal?: AbortSignal;
  onEvent: (event: VoiceAssistantEvent) => void;
}

interface ResolvedModel {
  modelId: string;
  displayName: string;
  tier: "FREE" | "PRO";
}

interface MessageRow {
  id: string;
  role: string;
  content: string;
  language: string;
  spoken: boolean;
  voice: string | null;
  audioMs: number;
  creditsCharged: number;
  interrupted: boolean;
  createdAt: Date;
}

const INSUFFICIENT = `Insufficient credits. Talking with ${VOICE_ASSISTANT_NAME} requires at least ${VOICE_ASSISTANT_REPLY_CREDITS} credit.`;
const MODEL_FAILED = `${VOICE_ASSISTANT_NAME} couldn't answer. Try again or choose another model.`;

/**
 * Robotina — the AI voice assistant (ARCHITECTURE.md §14g).
 *
 * One reply = one SSE stream:
 *   start → delta… (text as the model writes) → audio… (Aura-2 speech,
 *   sentence by sentence, in order) → done (credits, balance).
 *
 * The reply language follows the user's message (en/es/pt, see
 * `language.ts`) and picks the Aura-2 voice. Speech is synthesized while
 * the model is still writing: the first sentence is sent to Deepgram as
 * soon as it's complete, later chunks in parallel, emitted in order.
 *
 * Billing (CreditService — atomic debit, thresholds, credit emails):
 * 1 credit per written reply; a spoken reply costs 1 credit per started
 * minute of speech. Voice input is billed apart by the STT gateway. A reply
 * that fails before any text, or is cancelled before the first word, is free.
 */
@Injectable()
export class VoiceAssistantService {
  private readonly logger = new Logger("VoiceAssistantService");

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly credits: CreditService,
    private readonly usage: PlatformUsageLogger,
    private readonly tts: TTSEngineService,
    @Optional() private readonly tools?: ToolRegistry,
  ) {}

  async reply(input: ReplyInput): Promise<void> {
    const started = Date.now();
    const emit = (event: VoiceAssistantEvent) => {
      if (!input.signal?.aborted) input.onEvent(event);
    };

    const model = await this.resolveModel(input.userId, input.modelId);
    const provider =
      (await this.providers.getStreamingProviderForModel(model.modelId)) ??
      (await this.providers.getProviderForModel(model.modelId));
    if (!provider) {
      throw new BadRequestException("Selected provider is not available");
    }
    if (
      !(await this.credits.hasEnoughCredits(
        input.userId,
        VOICE_ASSISTANT_REPLY_CREDITS,
      ))
    ) {
      throw new BadRequestException(INSUFFICIENT);
    }

    const conversation = input.conversationId
      ? await this.findConversation(input.userId, input.conversationId)
      : await prisma.voiceConversation.create({
          data: {
            userId: input.userId,
            title: titleFrom(input.content),
            modelId: model.modelId,
          },
        });
    const history = input.conversationId
      ? await this.history(conversation.id)
      : [];

    const language = resolveReplyLanguage({
      text: input.content,
      previous: input.conversationId ? conversation.language : null,
      hint: input.languageHint,
    });
    const userMessage = await prisma.voiceMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: input.content,
        language,
        spoken: input.spoken,
      },
    });

    const speak = input.spoken && this.tts.isAvailable();
    const voice = speak ? this.tts.voiceFor(language) : null;
    emit({
      type: "start",
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      language,
      voice: voice ? { model: voice.model, name: voice.name } : null,
      title: conversation.title,
    });

    // ── Speech: chunks synthesized in parallel, emitted in order ──────
    const ttsAbort = new AbortController();
    const onAbort = () => ttsAbort.abort();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    const chunker = new SpeechChunker();
    let speechOk = speak;
    let audioMs = 0;
    let audioIndex = 0;
    let voiceModel: string | null = null;
    let speechChain: Promise<void> = Promise.resolve();

    const say = (text: string) => {
      if (!speechOk) return;
      const pending = this.tts
        .synthesize({ text, language, signal: ttsAbort.signal })
        .then(
          (audio): TTSAudio | null => audio,
          (error: Error): null => {
            if (!ttsAbort.signal.aborted && speechOk) {
              speechOk = false;
              this.logger.warn("Speech synthesis failed, replying in text", {
                userId: input.userId,
                error: error.message,
              });
              emit({
                type: "audio_error",
                error: "Voice unavailable right now — replying in text.",
              });
            }
            return null;
          },
        );
      speechChain = speechChain.then(async () => {
        const audio = await pending;
        if (!audio || !speechOk || ttsAbort.signal.aborted) return;
        audioMs += audio.durationMs;
        voiceModel = audio.voice;
        emit({
          type: "audio",
          index: audioIndex++,
          mimeType: audio.mimeType,
          data: audio.audio.toString("base64"),
          durationMs: audio.durationMs,
          text,
        });
      });
    };

    // ── Text: stream the model ───────────────────────────────────────
    let content = "";
    let modelError: Error | null = null;
    const request: AIRequest = {
      taskType: TEXT_TASK,
      // DB-driven model id (AIModel is a legacy union of built-in names).
      model: model.modelId as AIRequest["model"],
      prompt: input.content,
      parameters: {
        systemPrompt: buildPersonaPrompt({
          language,
          spoken: speak,
          userName: await this.firstName(input.userId),
          tools: this.platformTools(),
        }),
        conversationHistory: history,
        temperature: input.temperature ?? DEFAULT_TEMPERATURE,
        maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      },
      userId: input.userId,
      toolId: VOICE_ASSISTANT_TOOL_ID,
    };

    try {
      if (provider.generateStream) {
        for await (const chunk of provider.generateStream(request)) {
          if (input.signal?.aborted) break;
          if (chunk.type === "error") throw new Error(chunk.error);
          if (chunk.type === "done") break;
          if (chunk.type === "content" && chunk.content) {
            content += chunk.content;
            emit({ type: "delta", content: chunk.content });
            if (speak) chunker.push(chunk.content).forEach(say);
          }
        }
      } else {
        const response = await provider.generate(request);
        content = (response.output as { content?: string })?.content ?? "";
        if (content) {
          emit({ type: "delta", content });
          if (speak) chunker.push(content).forEach(say);
        }
      }
    } catch (error) {
      modelError = error as Error;
      this.logger.error("Model call failed", {
        userId: input.userId,
        model: model.modelId,
        error: modelError.message,
      });
    }

    const interrupted = !!input.signal?.aborted;
    content = content.trim();
    if (speak && !interrupted) chunker.flush().forEach(say);

    if (!content) {
      ttsAbort.abort();
      input.signal?.removeEventListener("abort", onAbort);
      await this.usage
        .logUsage({
          userId: input.userId,
          toolId: VOICE_ASSISTANT_TOOL_ID,
          modelId: model.modelId,
          duration: Date.now() - started,
          success: false,
          credits: 0,
          error: interrupted ? "cancelled" : (modelError?.message ?? "empty"),
        })
        .catch(() => undefined);
      // Cancelled before the first word: the user's message stays (it was
      // said), nothing is charged.
      if (interrupted) return;
      // Failed: undo the turn so a retry doesn't leave it twice.
      await (
        input.conversationId
          ? prisma.voiceMessage.delete({ where: { id: userMessage.id } })
          : prisma.voiceConversation.delete({ where: { id: conversation.id } })
      ).catch(() => undefined);
      throw new BadGatewayException(MODEL_FAILED);
    }

    await speechChain;
    input.signal?.removeEventListener("abort", onAbort);

    // ── Save, then charge ────────────────────────────────────────────
    const cost = replyCredits({ hasContent: true, audioMs });
    const assistant = await prisma.voiceMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content,
        language,
        spoken: audioMs > 0,
        voice: audioMs > 0 ? voiceModel : null,
        audioMs,
        creditsCharged: cost,
        interrupted,
        modelId: model.modelId,
      },
    });
    await prisma.voiceConversation.update({
      where: { id: conversation.id },
      data: { language, modelId: model.modelId },
    });

    const charged = await this.charge(input.userId, cost, content);
    if (charged !== cost) {
      await prisma.voiceMessage
        .update({
          where: { id: assistant.id },
          data: { creditsCharged: charged },
        })
        .catch(() => undefined);
    }
    const balance = await this.credits.getBalance(input.userId);

    emit({
      type: "done",
      messageId: assistant.id,
      content,
      language,
      audioMs,
      credits: charged,
      balance,
    });

    await this.usage
      .logUsage({
        userId: input.userId,
        toolId: VOICE_ASSISTANT_TOOL_ID,
        modelId: model.modelId,
        duration: Date.now() - started,
        success: true,
        credits: charged,
        metadata: {
          conversationId: conversation.id,
          language,
          spoken: input.spoken,
          voice: voiceModel,
          audioMs,
          interrupted,
          chars: content.length,
        },
      })
      .catch(() => undefined);
  }

  async listConversations(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: VoiceConversationSummary[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = { userId };
    const [rows, total] = await Promise.all([
      prisma.voiceConversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      prisma.voiceConversation.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        language: row.language as TTSLanguage,
        lastMessage: row.messages[0]?.content ?? null,
        messageCount: row._count.messages,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<VoiceConversationDetail> {
    const row = await prisma.voiceConversation.findFirst({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) throw new NotFoundException("Conversation not found");
    const messages = row.messages.map(toMessage);
    return {
      id: row.id,
      title: row.title,
      language: row.language as TTSLanguage,
      lastMessage: messages.at(-1)?.content ?? null,
      messageCount: messages.length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messages,
    };
  }

  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const { count } = await prisma.voiceConversation.deleteMany({
      where: { id: conversationId, userId },
    });
    if (count === 0) throw new NotFoundException("Conversation not found");
  }

  /**
   * Debits the reply. If the balance dropped below the price meanwhile
   * (a long spoken reply, another tool in parallel), what is left is taken
   * instead — the reply was already heard. Returns the credits charged.
   */
  private async charge(
    userId: string,
    cost: number,
    content: string,
  ): Promise<number> {
    if (cost <= 0) return 0;
    const description = `${VOICE_ASSISTANT_NAME}: ${content.slice(0, 50)}`;
    if (
      await this.credits.deduct(
        userId,
        cost,
        VOICE_ASSISTANT_TOOL_ID,
        description,
      )
    ) {
      return cost;
    }
    const balance = await this.credits.getBalance(userId);
    const partial = Math.min(balance, cost);
    if (
      partial > 0 &&
      (await this.credits.deduct(
        userId,
        partial,
        VOICE_ASSISTANT_TOOL_ID,
        description,
      ))
    ) {
      this.logger.warn("Reply charged partially (balance too low)", {
        userId,
        cost,
        charged: partial,
      });
      return partial;
    }
    this.logger.warn("Reply could not be charged", { userId, cost });
    return 0;
  }

  private async findConversation(userId: string, conversationId: string) {
    const conversation = await prisma.voiceConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  /** The last messages, oldest first, as chat history for the model. */
  private async history(
    conversationId: string,
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const rows = await prisma.voiceMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: VOICE_ASSISTANT_HISTORY_MESSAGES,
      select: { role: true, content: true },
    });
    return rows
      .reverse()
      .filter((m) => m.content.trim())
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));
  }

  private async firstName(userId: string): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      return user?.name?.trim().split(/\s+/)[0] || null;
    } catch {
      return null;
    }
  }

  private platformTools(): Array<{ name: string; description: string }> {
    try {
      return (this.tools?.getActive() ?? [])
        .filter((tool) => tool.id !== VOICE_ASSISTANT_TOOL_ID)
        .map((tool) => ({ name: tool.name, description: tool.description }));
    } catch {
      return [];
    }
  }

  /** Active text model; PRO models need a paid plan (as in every tool). */
  private async resolveModel(
    userId: string,
    modelId: string,
  ): Promise<ResolvedModel> {
    const model = await prisma.modelMetadata.findFirst({
      where: { modelId, isActive: true, taskType: TEXT_TASK },
      select: { modelId: true, displayName: true, tier: true },
    });
    if (!model) {
      throw new BadRequestException("Selected provider is not available");
    }
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
}

function titleFrom(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > MAX_TITLE_CHARS
    ? `${clean.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`
    : clean;
}

function toMessage(row: MessageRow): VoiceAssistantMessage {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    language: row.language as TTSLanguage,
    spoken: row.spoken,
    voice: row.voice,
    audioMs: row.audioMs,
    creditsCharged: row.creditsCharged,
    interrupted: row.interrupted,
    createdAt: row.createdAt.toISOString(),
  };
}
