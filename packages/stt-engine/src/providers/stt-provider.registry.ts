import { Injectable } from "@nestjs/common";
import type { STTProviderName } from "@creator-hub/shared-types";
import type { STTProviderInterface } from "./stt-provider.interface";

@Injectable()
export class STTProviderRegistry {
  private providers = new Map<STTProviderName, STTProviderInterface>();

  register(provider: STTProviderInterface): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: STTProviderName): STTProviderInterface {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`STT provider not found: ${name}`);
    }
    return provider;
  }

  getAvailableProvider(): STTProviderInterface | undefined {
    for (const provider of this.providers.values()) {
      if (provider.validateConfig()) {
        return provider;
      }
    }
    return undefined;
  }

  isRegistered(name: STTProviderName): boolean {
    return this.providers.has(name);
  }

  getAllProviders(): STTProviderInterface[] {
    return Array.from(this.providers.values());
  }
}
