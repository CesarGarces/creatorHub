import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { STTProviderRegistry } from "./stt-provider.registry";
import { DeepgramProvider } from "./deepgram.provider";
import { MockSTTProvider } from "./mock-stt.provider";

@Injectable()
export class STTProviderFactory implements OnModuleInit {
  private logger = new Logger("STTProviderFactory");

  constructor(private registry: STTProviderRegistry) {}

  onModuleInit() {
    this.registerBuiltInProviders();
  }

  private registerBuiltInProviders() {
    const deepgram = new DeepgramProvider();
    if (deepgram.validateConfig()) {
      this.registry.register(deepgram);
      this.logger.log("Registered STT provider: deepgram");
    } else {
      this.logger.warn(
        "Deepgram API key not found, skipping deepgram STT provider",
      );
    }

    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
    if (isDev || this.registry.getAllProviders().length === 0) {
      const mock = new MockSTTProvider();
      this.registry.register(mock);
      this.logger.log("Registered STT provider: mock (dev/fallback)");
    }
  }
}
