import type {
  STTProviderInterface,
  STTStreamParams,
  STTStream,
} from "./stt-provider.interface";

export abstract class STTProviderBase implements STTProviderInterface {
  abstract readonly name: STTProviderInterface["name"];
  abstract readonly supportedLanguages: string[];

  abstract createStream(params: STTStreamParams): STTStream;

  validateConfig(): boolean {
    const envVar = this.getApiKeyEnvVar();
    return envVar ? !!process.env[envVar] : true;
  }

  protected abstract getApiKeyEnvVar(): string | null;

  protected getApiKey(): string {
    const envVar = this.getApiKeyEnvVar();
    const key = envVar ? process.env[envVar] : undefined;
    if (!key) {
      throw new Error(`API key not configured for STT provider: ${this.name}`);
    }
    return key;
  }
}
