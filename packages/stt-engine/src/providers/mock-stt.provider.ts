import { randomUUID } from "crypto";
import { STTProviderBase } from "./stt-provider.base";
import type {
  STTProviderName,
  STTStreamParams,
  STTStream,
  STTFinalResult,
} from "@creator-hub/shared-types";

export class MockSTTProvider extends STTProviderBase {
  readonly name: STTProviderName = "mock";
  readonly supportedLanguages = ["en", "es"];

  protected getApiKeyEnvVar(): string | null {
    return null;
  }

  createStream(params: STTStreamParams): STTStream {
    const streamId = randomUUID();
    const startTime = Date.now();
    let closed = false;
    let fullTranscript = "";

    const stream: STTStream = {
      id: streamId,

      writeAudioChunk(_chunk: Buffer | ArrayBuffer) {
        if (closed) return;
        const words = [
          "Hello",
          "this",
          "is",
          "a",
          "mock",
          "transcription",
          "stream",
        ];
        const elapsed = Date.now() - startTime;
        const wordIndex = Math.min(Math.floor(elapsed / 500), words.length - 1);
        const partial = words.slice(0, wordIndex + 1).join(" ");
        const isFinal = wordIndex >= words.length - 1;

        if (isFinal) {
          fullTranscript = partial;
        }
        params.onPartialTranscript(partial, isFinal);
      },

      async end(): Promise<STTFinalResult> {
        closed = true;
        if (!fullTranscript) {
          fullTranscript = "Mock transcription result";
        }
        return {
          fullTranscript,
          language: params.language || "en",
          durationMs: Date.now() - startTime,
          wordCount: fullTranscript.split(/\s+/).filter((w) => w.length > 0)
            .length,
        };
      },

      close() {
        closed = true;
      },
    };

    return stream;
  }
}
