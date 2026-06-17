import type {
  STTProviderName,
  STTStreamParams,
  STTStream,
  STTFinalResult,
} from "@creator-hub/shared-types";

export interface STTProviderInterface {
  readonly name: STTProviderName;
  readonly supportedLanguages: string[];

  createStream(params: STTStreamParams): STTStream;
  validateConfig(): boolean;
}

export type { STTStreamParams, STTStream, STTFinalResult };
