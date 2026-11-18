import type {
  TTSAudio,
  TTSLanguage,
  TTSProviderName,
  TTSSynthesizeParams,
} from "@creator-hub/shared-types";

export interface TTSProviderInterface {
  readonly name: TTSProviderName;
  readonly supportedLanguages: readonly TTSLanguage[];

  synthesize(params: TTSSynthesizeParams): Promise<TTSAudio>;
  validateConfig(): boolean;
}

export type { TTSAudio, TTSLanguage, TTSSynthesizeParams };
