import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { TTSProviderRegistry } from "./tts-provider.registry";
import { DeepgramTTSProvider } from "./deepgram-tts.provider";
import { MockTTSProvider } from "./mock-tts.provider";

/**
 * Registers the built-in TTS providers, like `STTProviderFactory`: Deepgram
 * (Aura-2 and Flux) when `DEEPGRAM_API_KEY` is set (the same key as
 * speech-to-text), and the silent mock in development/test only. Unlike STT
 * there is no mock fallback in production: without Deepgram the platform
 * answers in text (`TTSEngineService.isAvailable()` is false) instead of
 * charging for silence.
 */
@Injectable()
export class TTSProviderFactory implements OnModuleInit {
  private logger = new Logger("TTSProviderFactory");

  constructor(private registry: TTSProviderRegistry) {}

  onModuleInit() {
    this.registerBuiltInProviders();
  }

  registerBuiltInProviders() {
    const deepgram = new DeepgramTTSProvider();
    if (deepgram.validateConfig()) {
      this.registry.register(deepgram);
      this.logger.log("Registered TTS provider: deepgram (Aura-2/Flux)");
    } else {
      this.logger.warn(
        "Deepgram API key not found, skipping deepgram TTS provider",
      );
    }

    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
    if (isDev) {
      this.registry.register(new MockTTSProvider());
      this.logger.log("Registered TTS provider: mock (dev/fallback)");
    }
  }
}
