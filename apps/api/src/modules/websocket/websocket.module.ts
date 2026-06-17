import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { STTEngineModule } from "@creator-hub/stt-engine";
import { AppGateway } from "./websocket.gateway";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") || "default-secret",
      }),
      inject: [ConfigService],
    }),
    STTEngineModule,
  ],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class WebsocketModule {}
