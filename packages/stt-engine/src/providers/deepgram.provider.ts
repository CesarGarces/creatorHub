import WebSocket from "ws";
import { randomUUID } from "crypto";
import { STTProviderBase } from "./stt-provider.base";
import type {
  STTProviderName,
  STTStreamParams,
  STTStream,
  STTFinalResult,
} from "@creator-hub/shared-types";

interface DeepgramTranscriptMessage {
  type: "Results" | "UtteranceEnd" | "Error" | "Metadata";
  channel?: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
        punctuated_word?: string;
      }>;
    }>;
  };
  is_final?: boolean;
  speech_final?: boolean;
  channel_final?: boolean;
  utterance_id?: number;
  last_word_end?: number;
}

export class DeepgramProvider extends STTProviderBase {
  readonly name: STTProviderName = "deepgram";
  readonly supportedLanguages = [
    "en",
    "es",
    "fr",
    "de",
    "pt",
    "it",
    "nl",
    "ja",
    "ko",
    "zh",
    "hi",
    "ar",
    "ru",
    "sv",
    "pl",
    "tr",
    "vi",
    "th",
  ];

  protected getApiKeyEnvVar(): string | null {
    return "DEEPGRAM_API_KEY";
  }

  createStream(params: STTStreamParams): STTStream {
    const apiKey = this.getApiKey();
    const streamId = randomUUID();

    const lang = params.language || "en";
    const interimResults = params.interimResults !== false;
    const endpointing = params.endpointing ?? 300;
    const utteranceEndMs = params.utteranceEndMs ?? 3000;

    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("channels", "1");
    url.searchParams.set("model", "nova-3");
    url.searchParams.set("language", lang);
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", String(interimResults));
    url.searchParams.set("endpointing", String(endpointing));
    url.searchParams.set("utterance_end_ms", String(utteranceEndMs));

    const ws = new WebSocket(url.toString(), {
      headers: { Authorization: `Token ${apiKey}` },
    });

    let closed = false;
    const startTime = Date.now();
    let fullTranscript = "";

    const stream: STTStream = {
      id: streamId,

      writeAudioChunk(chunk: Buffer | ArrayBuffer) {
        if (closed || ws.readyState !== WebSocket.OPEN) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        ws.send(buf);
      },

      end(): Promise<STTFinalResult> {
        return new Promise((resolve) => {
          if (closed) {
            resolve({
              fullTranscript,
              language: lang,
              durationMs: Date.now() - startTime,
              wordCount: fullTranscript.split(/\s+/).filter((w) => w.length > 0)
                .length,
            });
            return;
          }

          const onClose = () => {
            ws.removeListener("close", onClose);
            resolve({
              fullTranscript,
              language: lang,
              durationMs: Date.now() - startTime,
              wordCount: fullTranscript.split(/\s+/).filter((w) => w.length > 0)
                .length,
            });
          };

          ws.on("close", onClose);

          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(1000, "stream ended");
            }
          } catch {
            ws.removeListener("close", onClose);
            onClose();
          }
        });
      },

      close() {
        if (closed) return;
        closed = true;
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1000, "cleanup");
          }
        } catch {
          /* ignore */
        }
      },
    };

    ws.on("message", (data: Buffer) => {
      try {
        const msg: DeepgramTranscriptMessage = JSON.parse(data.toString());
        console.log(
          "[Deepgram] Message type:",
          msg.type,
          msg.is_final ? "(final)" : "(interim)",
        );

        if (msg.type === "Results" && msg.channel) {
          const transcript = msg.channel.alternatives[0]?.transcript || "";
          if (!transcript) return;

          const isFinal = msg.is_final === true || msg.speech_final === true;

          if (isFinal) {
            fullTranscript += (fullTranscript ? " " : "") + transcript;
          }

          params.onPartialTranscript(transcript, isFinal);
        } else if (msg.type === "UtteranceEnd") {
          params.onUtteranceEnd();
        } else if (msg.type === "Error") {
          params.onError(
            new Error(`Deepgram error: ${(msg as any).message || "Unknown"}`),
          );
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("open", () => {
      console.log("[Deepgram] WebSocket connected for stream", streamId);
    });

    ws.on("error", (err: Error) => {
      console.error("[Deepgram] WebSocket error:", err.message);
      params.onError(err);
      closed = true;
    });

    ws.on("close", () => {
      closed = true;
    });

    return stream;
  }
}
