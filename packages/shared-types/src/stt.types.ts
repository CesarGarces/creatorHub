export type STTProviderName = "deepgram" | "mock";

export interface STTStreamParams {
  language?: string;
  /** Deepgram model (Admin → Voice); the provider's default when omitted. */
  model?: string;
  interimResults?: boolean;
  endpointing?: number;
  utteranceEndMs?: number;
  onPartialTranscript: (text: string, isFinal: boolean) => void;
  onUtteranceEnd: () => void;
  onError: (error: Error) => void;
  /**
   * The provider closed the stream on its own (network, provider timeout,
   * rejected audio…) — not because `end()`/`close()` was called.
   */
  onUnexpectedClose?: (info: { code: number; reason: string }) => void;
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
  /**
   * Id the client gave in `stt:start`; echoed in every `stt:*` event of the
   * session so a late event of an earlier session can't affect a new one.
   */
  requestId?: string;
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
  /**
   * The server ended the recording: the balance paid for no more seconds,
   * or the Free plan's minutes with Robotina ran out (the recording is
   * billed up to there and its text delivered).
   */
  endedBy?: "credit-limit" | "free-limit";
}

export interface STTErrorPayload {
  code: string;
  message: string;
}

/** Why a session was closed (logged; sent to the client when unexpected). */
export type STTCloseReason =
  | "ended-by-client"
  | "client-disconnected"
  | "replaced-by-new-session"
  | "stream-error"
  | "provider-closed"
  | "time-limit"
  | "credit-limit";

/** `stt:error` codes the client can react to. */
export type STTErrorCode =
  | "UNAUTHORIZED"
  | "INSUFFICIENT_CREDITS"
  | "START_FAILED"
  | "STREAM_ERROR"
  | "PROVIDER_CLOSED"
  | "SESSION_TIMEOUT"
  | "SESSION_LOST"
  | "FREE_LIMIT_REACHED";

export const MIN_CREDITS_FOR_STT = 5;
export const MAX_STT_SESSION_MS = 180_000;
// Price: credits per second, set in Admin → Voice (voice-settings.types.ts).
