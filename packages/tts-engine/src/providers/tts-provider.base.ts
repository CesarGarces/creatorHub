import type {
  TTSAudio,
  TTSProviderInterface,
  TTSSynthesizeParams,
} from "./tts-provider.interface";

export abstract class TTSProviderBase implements TTSProviderInterface {
  abstract readonly name: TTSProviderInterface["name"];
  abstract readonly supportedLanguages: TTSProviderInterface["supportedLanguages"];

  abstract synthesize(params: TTSSynthesizeParams): Promise<TTSAudio>;

  validateConfig(): boolean {
    const envVar = this.getApiKeyEnvVar();
    return envVar ? !!process.env[envVar] : true;
  }

  protected abstract getApiKeyEnvVar(): string | null;

  protected getApiKey(): string {
    const envVar = this.getApiKeyEnvVar();
    const key = envVar ? process.env[envVar] : undefined;
    if (!key) {
      throw new Error(`API key not configured for TTS provider: ${this.name}`);
    }
    return key;
  }
}
