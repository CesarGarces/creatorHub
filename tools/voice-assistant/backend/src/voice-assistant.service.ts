import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { prisma, type Prisma } from "@creator-hub/database";
import { ProviderRegistry } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { PlatformUsageLogger } from "@creator-hub/analytics";
import { TTSEngineService } from "@creator-hub/tts-engine";
import {
  VoiceAllowanceService,
  VoiceSettingsService,
} from "@creator-hub/voice-settings";
import { AssistantActionRegistry, ToolRegistry } from "@creator-hub/tool-sdk";
import { Logger, isValidTimeZone } from "@creator-hub/shared-utils";
import {
  ASSISTANT_CONFIRMATION_TTL_MS,
  ASSISTANT_MAX_ACTIONS_PER_REPLY,
  FREE_VOICE_LIMIT_CODE,
  FREE_VOICE_LIMIT_MESSAGE,
  ttsVoiceInfo,
  voiceSecondsAffordable,
  type AssistantActionArgs,
  type AssistantActionContext,
  type AssistantActionRecord,
} from "@creator-hub/shared-types";
import type {
  AIRequest,
  TTSAudio,
  TTSLanguage,
  VoiceAssistantEvent,
  VoiceAssistantMessage,
  VoiceConversationDetail,
  VoiceConversationSummary,
} from "@creator-hub/shared-types";
import { LANGUAGE_NAMES, resolveReplyLanguage } from "./language";
import {
  ACTION_CLOSE,
  ACTION_OPEN,
  ActionStreamParser,
  announcesAction,
  type ActionCall,
} from "./action-parser";
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
  /** IANA time zone of the user's browser (actions' dates and times). */
  timeZone?: string;
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
  actions?: unknown;
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
 * `language.ts`) and picks its voice (Admin → Voice). Speech is synthesized while
 * the model is still writing: the first sentence is sent to Deepgram as
 * soon as it's complete, later chunks in parallel, emitted in order.
 *
 * Actions: when the model writes an `<action>` (see action-parser.ts), it
 * is hidden from text and voice, run through the AssistantActionRegistry
 * (e.g. the Content Planner's calendar.create_event) and reported as SSE
 * `action` events; the model then gets the result and tells the user.
 *
 * Voice and prices come from Admin → Voice (VoiceSettingsService): the
 * Aura voice set for the reply language, and the TTS price per second.
 *
 * Billing (CreditService — atomic debit, thresholds, credit emails):
 * 1 credit per written reply; a spoken reply costs its seconds of speech
 * at the TTS price (never less than a written one). She only speaks what
 * the balance pays for — then the reply goes on in text. Free plan users
 * get the minutes set in Admin → Voice (their voice + hers): her speech is
 * counted, and once they are used up replies are refused with
 * FREE_LIMIT_REACHED (the app invites them to upgrade). Voice input is
 * billed apart by the STT gateway. A reply that fails before any text, or
 * is cancelled before the first word, is free.
 */
@Injectable()
export class VoiceAssistantService {
  private readonly logger = new Logger("VoiceAssistantService");

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly credits: CreditService,
    private readonly usage: PlatformUsageLogger,
    private readonly tts: TTSEngineService,
    private readonly voiceSettings: VoiceSettingsService,
    private readonly voiceAllowance: VoiceAllowanceService,
    @Optional() private readonly tools?: ToolRegistry,
    @Optional() private readonly actions?: AssistantActionRegistry,
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
    // Free plan: minutes of voice with her (Admin → Voice). Used up → the
    // app invites the user to upgrade for unlimited use.
    const allowance = await this.voiceAllowance.get(input.userId);
    if (allowance.exhausted) {
      throw new ForbiddenException({
        statusCode: 403,
        code: FREE_VOICE_LIMIT_CODE,
        message: FREE_VOICE_LIMIT_MESSAGE,
      });
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

    // Destructive actions she asked to confirm in her previous reply.
    const pending = input.conversationId
      ? await this.pendingConfirmations(conversation.id)
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
    // The voice set for this language and the price per second of speech.
    const settings = await this.voiceSettings.get();
    const ttsRate = settings.tts.creditsPerSecond;
    const voice = speak
      ? ttsVoiceInfo(settings.tts.voices[language].voice, language)
      : null;
    // She speaks only what the balance — and a Free user's minutes left —
    // pay for; the rest stays in text.
    const creditBudgetMs = speak
      ? voiceSecondsAffordable(
          await this.credits.getBalance(input.userId).catch(() => 0),
          ttsRate,
        ) * 1000
      : 0;
    const freeBudgetMs =
      allowance.remainingSeconds === null
        ? Infinity
        : allowance.remainingSeconds * 1000;
    const speechBudgetMs = Math.min(creditBudgetMs, freeBudgetMs);
    const budgetLimit: "credits" | "free-limit" =
      freeBudgetMs < creditBudgetMs ? "free-limit" : "credits";
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
        .synthesize({
          text,
          language,
          voice: voice?.model,
          signal: ttsAbort.signal,
        })
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
        if (audioMs + audio.durationMs > speechBudgetMs) {
          speechOk = false;
          ttsAbort.abort(); // later sentences are not synthesized
          this.logger.warn(`Speech stopped: ${budgetLimit}`, {
            userId: input.userId,
            audioMs,
            speechBudgetMs,
          });
          emit({
            type: "audio_error",
            reason: budgetLimit,
            error:
              budgetLimit === "free-limit"
                ? "Your free minutes with Robotina ran out — the rest is in text."
                : "Not enough credits for her voice — the rest is in text.",
          });
          return;
        }
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

    // ── Text: stream the model, run the actions it asks for ─────────
    const timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";
    const actionContext: AssistantActionContext = {
      userId: input.userId,
      timeZone,
      now: new Date(),
      language,
    };
    const systemPrompt = buildPersonaPrompt({
      language,
      spoken: speak,
      userName: await this.firstName(input.userId),
      tools: this.platformTools(),
      actions: this.actions?.list() ?? [],
      timeZone,
      now: actionContext.now,
    });

    /** Everything shown and spoken (never the action tags). */
    let content = "";
    let spaceBeforeNext = false;
    const show = (text: string) => {
      if (!text) return;
      if (spaceBeforeNext && text.trim()) {
        text = ` ${text.trimStart()}`;
        spaceBeforeNext = false;
      }
      content += text;
      emit({ type: "delta", content: text });
      if (speak) chunker.push(text).forEach(say);
    };

    let modelError: Error | null = null;
    const actions: AssistantActionRecord[] = [];
    const canAct = (this.actions?.list().length ?? 0) > 0;
    /** One self-correction per reply (see `nudgeFor`). */
    let nudged = false;
    let conversationHistory = history;
    let prompt = input.content;

    // Round 0 answers the user; after each action, one more round lets her
    // say what happened (or ask for what's missing).
    for (let round = 0; ; round++) {
      const parser = new ActionStreamParser();
      let written = "";
      const roundStart = content.length;
      const request: AIRequest = {
        taskType: TEXT_TASK,
        // DB-driven model id (AIModel is a legacy union of built-in names).
        model: model.modelId as AIRequest["model"],
        prompt,
        parameters: {
          systemPrompt,
          conversationHistory,
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
              written += chunk.content;
              show(parser.push(chunk.content));
              // The action is complete: nothing after it is used.
              if (parser.complete) break;
            }
          }
        } else {
          const response = await provider.generate(request);
          written = (response.output as { content?: string })?.content ?? "";
          show(parser.push(written));
        }
      } catch (error) {
        modelError = error as Error;
        this.logger.error("Model call failed", {
          userId: input.userId,
          model: model.modelId,
          round,
          error: modelError.message,
        });
      }
      if (input.signal?.aborted || modelError) break;

      const ending = parser.end();
      show(ending.text);
      if (!ending.action) {
        // She announced an action without writing it (or wrote one that
        // can't be read): nothing would happen and the turn would pass to
        // the user. Ask the model once, in the same reply, to do it.
        const nudge =
          canAct && !nudged
            ? nudgeFor(ending, content.slice(roundStart), language)
            : null;
        if (nudge) {
          nudged = true;
          this.logger.warn("Action announced but not written — nudging", {
            userId: input.userId,
            model: model.modelId,
            malformed: ending.malformed,
          });
          if (speak) chunker.flush().forEach(say);
          conversationHistory = [
            ...conversationHistory,
            { role: "user", content: prompt },
            { role: "assistant", content: written.trim() },
          ];
          prompt = nudge;
          spaceBeforeNext = content.length > 0 && !/\s$/.test(content);
          continue;
        }
        if (ending.malformed) {
          this.logger.warn("Unreadable action from the model", {
            userId: input.userId,
            model: model.modelId,
          });
        }
        break;
      }
      if (actions.length >= ASSISTANT_MAX_ACTIONS_PER_REPLY) {
        this.logger.warn("Too many actions in one reply", {
          userId: input.userId,
        });
        break;
      }

      // Say what she has said so far while the action runs.
      if (speak) chunker.flush().forEach(say);
      const record = await this.runAction(
        ending.action,
        actionContext,
        emit,
        pending,
      );
      actions.push(record);
      if (input.signal?.aborted) break;

      conversationHistory = [
        ...conversationHistory,
        { role: "user", content: prompt },
        { role: "assistant", content: written.trim() },
      ];
      prompt = `ACTION RESULT (${record.name}: ${RESULT_LABELS[record.status]}) — ${record.summary}\n${
        record.status === "needs_confirmation"
          ? "Now ask the user to confirm"
          : "Now tell the user what happened"
      }, in ${LANGUAGE_NAMES[language]}.`;
      spaceBeforeNext = content.length > 0 && !/\s$/.test(content);
    }

    const interrupted = !!input.signal?.aborted;
    content = content.trim();
    if (speak && !interrupted) chunker.flush().forEach(say);

    if (!content && actions.length === 0) {
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
    const cost = replyCredits({
      hasContent: true,
      audioMs,
      ttsCreditsPerSecond: ttsRate,
    });
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
        ...(actions.length > 0
          ? { actions: actions as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    await prisma.voiceConversation.update({
      where: { id: conversation.id },
      data: { language, modelId: model.modelId },
    });

    const charged = await this.charge(
      input.userId,
      cost,
      content || actions[0]?.summary || "",
    );
    if (charged !== cost) {
      await prisma.voiceMessage
        .update({
          where: { id: assistant.id },
          data: { creditsCharged: charged },
        })
        .catch(() => undefined);
    }
    const balance = await this.credits.getBalance(input.userId);
    // Her voice counts towards a Free user's minutes.
    if (allowance.limited && audioMs > 0) {
      await this.voiceAllowance.record(input.userId, audioMs);
    }

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
          actions: actions.map((a) => `${a.name}:${a.status}`),
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
   * Runs one action the model asked for and reports it as SSE events.
   * Actions that require confirmation (deletes) only run when the previous
   * reply asked for the very same one and the user has answered since;
   * otherwise they are previewed and wait (`needs_confirmation`).
   */
  private async runAction(
    call: ActionCall,
    context: AssistantActionContext,
    emit: (event: VoiceAssistantEvent) => void,
    pending: AssistantActionRecord[],
  ): Promise<AssistantActionRecord> {
    const id = randomUUID();
    const requested = primitiveArgs(call.args);
    emit({
      type: "action",
      id,
      name: call.name,
      status: "running",
      args: requested,
    });

    let record: AssistantActionRecord;
    const definition = this.actions?.get(call.name);
    if (this.actions && definition?.requiresConfirmation) {
      const preview = await this.actions.preview(call.name, call.args, context);
      const confirmed =
        preview.ok &&
        takeConfirmation(pending, call.name, preview.args) !== null;
      if (!preview.ok || !confirmed) {
        record = {
          id,
          name: call.name,
          args: Object.keys(preview.args).length > 0 ? preview.args : requested,
          status: preview.ok ? "needs_confirmation" : "failed",
          summary: preview.ok
            ? `NOT DONE YET — it needs the user's confirmation. ${preview.summary} Ask the user to confirm it clearly (what and when) and stop there. Only if they say yes in their next message, call ${call.name} again with exactly the same arguments.`
            : preview.summary,
          ...(preview.data ? { data: preview.data } : {}),
        };
        emit({ type: "action", ...record });
        this.logger.info("Assistant action awaiting confirmation", {
          userId: context.userId,
          action: call.name,
          status: record.status,
        });
        return record;
      }
    }

    const result = this.actions
      ? await this.actions.execute(call.name, call.args, context)
      : { ok: false, summary: `Unknown action "${call.name}"`, args: {} };
    record = {
      id,
      name: call.name,
      args: Object.keys(result.args).length > 0 ? result.args : requested,
      status: result.ok ? "done" : "failed",
      summary: result.summary,
      ...(result.data ? { data: result.data } : {}),
    };
    emit({ type: "action", ...record });
    this.logger.info("Assistant action", {
      userId: context.userId,
      action: call.name,
      status: record.status,
    });
    return record;
  }

  /**
   * `needs_confirmation` actions of her last reply in this conversation,
   * if it is recent: the user's current message may confirm them.
   */
  private async pendingConfirmations(
    conversationId: string,
  ): Promise<AssistantActionRecord[]> {
    const last = await prisma.voiceMessage.findFirst({
      where: { conversationId, role: "assistant" },
      orderBy: { createdAt: "desc" },
      select: { actions: true, createdAt: true },
    });
    if (
      !last ||
      Date.now() - last.createdAt.getTime() > ASSISTANT_CONFIRMATION_TTL_MS
    ) {
      return [];
    }
    return actionRecords(last.actions).filter(
      (a) => a.status === "needs_confirmation",
    );
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
      select: { role: true, content: true, actions: true },
    });
    return rows
      .reverse()
      .map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as
          | "assistant"
          | "user",
        // She remembers what she did, not only what she said.
        content: [m.content, ...actionNotes(m.actions)]
          .filter((part) => part.trim())
          .join("\n"),
      }))
      .filter((m) => m.content);
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

/**
 * The self-correction message for a round that ended without a usable
 * action although one was meant: a tag that can't be read, or words like
 * "let me check" with no tag. Null when nothing needs correcting.
 */
export function nudgeFor(
  ending: { malformed: boolean; raw: string },
  said: string,
  language: TTSLanguage,
): string | null {
  const format = `${ACTION_OPEN}{"name":"<action name>","args":{...}}${ACTION_CLOSE}`;
  if (ending.malformed) {
    return `SYSTEM NOTE (not from the user): your action could not be read: ${ending.raw.slice(0, 300)}\nReply with ONLY the action, exactly like ${format} — no other words.`;
  }
  if (announcesAction(said)) {
    return `SYSTEM NOTE (not from the user): you told the user you would do it, but you did not write the action, so nothing happened and the user is still waiting. If you have every required detail, reply with ONLY the action now, exactly like ${format} — no other words. If a detail is missing, ask the user for it in one short sentence in ${LANGUAGE_NAMES[language]}.`;
  }
  return null;
}

const RESULT_LABELS: Record<AssistantActionRecord["status"], string> = {
  done: "success",
  failed: "failed",
  needs_confirmation: "needs confirmation",
  running: "running",
};

function sameArgs(a: AssistantActionArgs, b: AssistantActionArgs): boolean {
  const canonical = (args: AssistantActionArgs) =>
    JSON.stringify(Object.entries(args).sort(([x], [y]) => x.localeCompare(y)));
  return canonical(a) === canonical(b);
}

/**
 * Removes and returns the pending confirmation for this exact call (each
 * "yes" confirms one action once), or null.
 */
function takeConfirmation(
  pending: AssistantActionRecord[],
  name: string,
  args: AssistantActionArgs,
): AssistantActionRecord | null {
  const index = pending.findIndex(
    (p) => p.name === name && sameArgs(p.args, args),
  );
  if (index === -1) return null;
  return pending.splice(index, 1)[0]!;
}

/** Only primitive values of model-written arguments (shown to the user). */
function primitiveArgs(raw: unknown): AssistantActionArgs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const args: AssistantActionArgs = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      args[key] = value;
    }
  }
  return args;
}

function actionRecords(value: unknown): AssistantActionRecord[] {
  return Array.isArray(value) ? (value as AssistantActionRecord[]) : [];
}

/** "[calendar.create_event done: Created …]" lines for the model's memory. */
function actionNotes(value: unknown): string[] {
  return actionRecords(value).map(
    (a) => `[${a.name} ${a.status}: ${a.summary ?? ""}]`,
  );
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
    actions: actionRecords(row.actions),
    createdAt: row.createdAt.toISOString(),
  };
}
