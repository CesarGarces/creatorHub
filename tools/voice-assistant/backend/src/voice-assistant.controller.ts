import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
import type { VoiceAssistantEvent } from "@creator-hub/shared-types";
// Rate limiting is applied globally (APP_GUARD ThrottlerGuard in AppModule).
import {
  ListConversationsQueryDto,
  SendMessageDto,
} from "./dto/send-message.dto";
import { VoiceAssistantService } from "./voice-assistant.service";

/** Minimal response surface used for Server-Sent Events. */
interface SseResponse {
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): void;
  end(): void;
  on(event: "close", listener: () => void): void;
  writableEnded?: boolean;
}

@Controller("tools/voice-assistant")
@UseGuards(JwtAuthGuard)
export class VoiceAssistantController {
  constructor(private readonly assistant: VoiceAssistantService) {}

  /**
   * Send a message to Robotina and stream her reply as SSE:
   * {type:"start"} → {type:"delta"}… → {type:"audio"}… → {type:"done"},
   * or {type:"error"}. Closing the stream (leaving, interrupting her)
   * stops the model and the voice; only what was produced is charged.
   */
  @Post("messages")
  async send(
    @CurrentUser("id") userId: string,
    @Body() dto: SendMessageDto,
    @Res() res: SseResponse,
  ): Promise<void> {
    const abort = new AbortController();
    const send = (event: VoiceAssistantEvent) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });

    try {
      await this.assistant.reply({
        userId,
        conversationId: dto.conversationId,
        content: dto.content,
        spoken: dto.spoken,
        modelId: dto.model,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        languageHint: dto.languageHint,
        timeZone: dto.timeZone,
        signal: abort.signal,
        onEvent: send,
      });
    } catch (error) {
      const status =
        (error as { getStatus?: () => number }).getStatus?.() ?? 500;
      const body = (
        error as { getResponse?: () => unknown }
      ).getResponse?.() as { code?: unknown } | undefined;
      send({
        type: "error",
        status,
        error:
          status >= 500 && status !== 502
            ? "Robotina couldn't answer. Please try again."
            : (error as Error).message,
        // e.g. FREE_LIMIT_REACHED: the app shows the upgrade invitation.
        ...(typeof body?.code === "string" ? { code: body.code } : {}),
      });
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  @Get("conversations")
  async list(
    @CurrentUser("id") userId: string,
    @Query() query: ListConversationsQueryDto,
  ) {
    const result = await this.assistant.listConversations(
      userId,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return { success: true, ...result };
  }

  @Get("conversations/:conversationId")
  async get(
    @CurrentUser("id") userId: string,
    @Param("conversationId") conversationId: string,
  ) {
    const data = await this.assistant.getConversation(userId, conversationId);
    return { success: true, data };
  }

  @Delete("conversations/:conversationId")
  async remove(
    @CurrentUser("id") userId: string,
    @Param("conversationId") conversationId: string,
  ) {
    await this.assistant.deleteConversation(userId, conversationId);
    return { success: true };
  }
}
