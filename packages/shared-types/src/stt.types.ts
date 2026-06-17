export type STTProviderName = "deepgram" | "mock";

export interface STTStreamParams {
  language?: string;
  interimResults?: boolean;
  endpointing?: number;
  utteranceEndMs?: number;
  onPartialTranscript: (text: string, isFinal: boolean) => void;
  onUtteranceEnd: () => void;
  onError: (error: Error) => void;
}

export interface STTStream {
  id: string;
  writeAudioChunk(chunk: Buffer | ArrayBuffer): void;
  end(): Promise<STTFinalResult>;
  close(): void;
}

export interface STTFinalResult {
  fullTranscript: string;
  language: string;
  durationMs: number;
  wordCount: number;
}

export interface STTProviderInterface {
  readonly name: STTProviderName;
  readonly supportedLanguages: string[];

  createStream(params: STTStreamParams): STTStream;
  validateConfig(): boolean;
}

export interface STTSessionInfo {
  sessionId: string;
  userId: string;
  clientId: string;
  stream: STTStream;
  startedAt: number;
  language: string;
  timeout: ReturnType<typeof setTimeout>;
}

export interface STTPartialTranscript {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface STTResultPayload {
  fullTranscript: string;
  durationMs: number;
  wordCount: number;
  credits: number;
}

export interface STTErrorPayload {
  code: string;
  message: string;
}

export const MIN_CREDITS_FOR_STT = 5;
export const MAX_STT_SESSION_MS = 180_000;
export const STT_CREDITS_PER_MINUTE = 1;
