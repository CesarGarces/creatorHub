import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Res,
} from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { ChatService } from "./chat.service";
import { ChatHistoryService } from "./chat-history.service";
import { ChatSettingsService } from "./chat-settings.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { UpdateChatSettingsDto } from "./dto/update-chat-settings.dto";
import type { Response } from "express";

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatHistoryService: ChatHistoryService,
    private chatSettingsService: ChatSettingsService,
  ) {}

  @Post("sessions")
  async createSession(
    @CurrentUser("id") userId: string,
    @Body()
    body: {
      title?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      reasoning?: number;
    },
  ) {
    return this.chatService.createSession(userId, body);
  }

  @Get("sessions")
  async listSessions(@CurrentUser("id") userId: string) {
    return this.chatHistoryService.listSessions(userId);
  }

  @Get("sessions/:id")
  async getSession(@Param("id") id: string) {
    return this.chatHistoryService.getSession(id);
  }

  @Delete("sessions/:id")
  async deleteSession(@Param("id") id: string) {
    return this.chatHistoryService.deleteSession(id);
  }

  @Post("sessions/:id/messages")
  async sendMessage(
    @Param("id") sessionId: string,
    @CurrentUser("id") userId: string,
    @Body() body: SendMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const stream = this.chatService.createMessageStream(
      sessionId,
      userId,
      body,
    );

    stream.on("data", (chunk: string) => {
      res.write(chunk);
    });

    stream.on("end", () => {
      res.end();
    });

    stream.on("error", (error: Error) => {
      const data = JSON.stringify({ type: "error", error: error.message });
      res.write(`data: ${data}\n\n`);
      res.end();
    });

    res.on("close", () => {
      stream.destroy();
    });
  }

  @Get("settings")
  async getSettings(@CurrentUser("id") userId: string) {
    return this.chatSettingsService.getSettings(userId);
  }

  @Put("settings")
  async updateSettings(
    @CurrentUser("id") userId: string,
    @Body() body: UpdateChatSettingsDto,
  ) {
    return this.chatSettingsService.updateSettings(userId, body);
  }

  @Get("tools")
  async getAvailableTools() {
    return this.chatService.getAvailableTools();
  }
}
