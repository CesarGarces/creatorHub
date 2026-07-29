import { IsNotEmpty, IsString, Matches } from "class-validator";

export class ConnectTelegramDto {
  /**
   * Bot token issued by @BotFather. We only enforce the basic shape
   * (digits:letters); the real validation happens when we call
   * Telegram's getMe endpoint in ChannelService.
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+:\S+$/, {
    message:
      "botToken does not look like a valid Telegram bot token (expected format: 123456789:ABCdef...)",
  })
  botToken!: string;
}
