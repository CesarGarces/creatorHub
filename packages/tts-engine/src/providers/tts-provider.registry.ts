import { Injectable } from "@nestjs/common";
import type { TTSProviderName } from "@creator-hub/shared-types";
import type { TTSProviderInterface } from "./tts-provider.interface";

@Injectable()
export class TTSProviderRegistry {
  private providers = new Map<TTSProviderName, TTSProviderInterface>();

  register(provider: TTSProviderInterface): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: TTSProviderName): TTSProviderInterface {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`TTS provider not found: ${name}`);
    }
    return provider;
  }

  /** First registered provider whose configuration is valid (Deepgram first). */
  getAvailableProvider(): TTSProviderInterface | undefined {
    for (const provider of this.providers.values()) {
      if (provider.validateConfig()) {
        return provider;
      }
    }
    return undefined;
  }

  isRegistered(name: TTSProviderName): boolean {
    return this.providers.has(name);
  }

  getAllProviders(): TTSProviderInterface[] {
    return Array.from(this.providers.values());
  }
}
