import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { CommunityBotConfigService } from "./services/community-bot-config.service";
import { ChannelService } from "./services/channel.service";
import { ConversationService } from "./services/conversation.service";
import { PlaygroundService } from "./services/playground.service";
import { UpdateCommunityBotConfigDto } from "./dto/update-community-bot-config.dto";
import { ConnectTelegramDto } from "./dto/connect-telegram.dto";
import { PlaygroundMessageDto } from "./dto/playground-message.dto";

@Controller("community-bot")
@UseGuards(JwtAuthGuard)
export class CommunityBotController {
  constructor(
    private readonly configService: CommunityBotConfigService,
    private readonly channelService: ChannelService,
    private readonly conversationService: ConversationService,
    private readonly playgroundService: PlaygroundService,
  ) {}

  // ─── Configuration ─────────────────────────────────────────

  @Get("config")
  async getConfig(@CurrentUser("id") userId: string) {
    const config = await this.configService.getOrCreate(userId);
    return { success: true, data: config };
  }

  @Put("config")
  async updateConfig(
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateCommunityBotConfigDto,
  ) {
    const config = await this.configService.update(userId, dto);
    return { success: true, data: config };
  }

  // ─── Channels ──────────────────────────────────────────────

  @Get("channels")
  async listChannels(@CurrentUser("id") userId: string) {
    const channels = await this.channelService.list(userId);
    return { success: true, data: channels };
  }

  @Post("channels/telegram/connect")
  async connectTelegram(
    @CurrentUser("id") userId: string,
    @Body() dto: ConnectTelegramDto,
  ) {
    const channel = await this.channelService.connectTelegram(
      userId,
      dto.botToken,
    );
    return { success: true, data: channel };
  }

  @Post("channels/whatsapp/connect")
  async connectWhatsApp(@CurrentUser("id") userId: string) {
    const channel = await this.channelService.connectWhatsApp(userId);
    return { success: true, data: channel };
  }

  @Delete("channels/:type/disconnect")
  async disconnectChannel(
    @CurrentUser("id") userId: string,
    @Param("type") type: string,
  ) {
    const normalized = type.toUpperCase();
    if (!["TELEGRAM", "WHATSAPP", "INSTAGRAM"].includes(normalized)) {
      return { success: false, error: { message: "Unknown channel type" } };
    }
    const channel = await this.channelService.disconnect(
      userId,
      normalized as "TELEGRAM" | "WHATSAPP" | "INSTAGRAM",
    );
    return { success: true, data: channel };
  }

  // ─── Conversations ─────────────────────────────────────────

  @Get("conversations")
  async listConversations(
    @CurrentUser("id") userId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.conversationService.listConversations(userId, page, limit);
  }

  @Get("conversations/:id/messages")
  async listMessages(
    @CurrentUser("id") userId: string,
    @Param("id") conversationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.conversationService.listMessages(
      userId,
      conversationId,
      page,
      limit,
    );
  }

  // ─── Playground ────────────────────────────────────────────

  @Post("playground")
  async playground(
    @CurrentUser("id") userId: string,
    @Body() dto: PlaygroundMessageDto,
  ) {
    const result = await this.playgroundService.generatePreview(
      userId,
      dto.message,
    );
    return { success: true, data: result };
  }
}
