import WebSocket from "ws";
import { randomUUID } from "crypto";
import { STTProviderBase } from "./stt-provider.base";
import { Logger } from "@creator-hub/shared-utils";
import {
  DEFAULT_STT_MODEL,
  sttListenLanguage,
  type STTProviderName,
  type STTStreamParams,
  type STTStream,
  type STTFinalResult,
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

/** Send a KeepAlive when no audio was sent for this long. */
const KEEPALIVE_MS = 5_000;
/** Longest wait for Deepgram's last results after CloseStream. */
const FINALIZE_TIMEOUT_MS = 3_000;

export class DeepgramProvider extends STTProviderBase {
  private logger = new Logger("DeepgramProvider");
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
    // Model from Admin → Voice; multilingual models hear en/es/pt… at once.
    const model = params.model || DEFAULT_STT_MODEL;
    url.searchParams.set("model", model);
    url.searchParams.set("language", sttListenLanguage(model, lang));
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", String(interimResults));
    url.searchParams.set("endpointing", String(endpointing));
    url.searchParams.set("utterance_end_ms", String(utteranceEndMs));

    const ws = new WebSocket(url.toString(), {
      headers: { Authorization: `Token ${apiKey}` },
    });

    let closed = false;
    /** end()/close() asked for it: a close then is not "unexpected". */
    let closeRequested = false;
    const startTime = Date.now();
    let fullTranscript = "";
    /** Latest interim text not yet confirmed by a final result. */
    let pendingInterim = "";
    let lastAudioAt = Date.now();
    /** When the client stopped: finalizing afterwards isn't billed. */
    let endedAt: number | null = null;
    const logger = this.logger;

    // Deepgram closes an idle stream after ~10 s without data: keep it open
    // through pauses (the browser may throttle audio, the user may think).
    const keepAlive = setInterval(() => {
      if (
        ws.readyState === WebSocket.OPEN &&
        Date.now() - lastAudioAt >= KEEPALIVE_MS
      ) {
        ws.send(JSON.stringify({ type: "KeepAlive" }));
      }
    }, KEEPALIVE_MS);
    keepAlive.unref?.();

    const result = (): STTFinalResult => {
      // Words Deepgram never finalized (stopped mid-phrase) still count.
      const text = [fullTranscript, pendingInterim]
        .filter((part) => part.trim())
        .join(" ")
        .trim();
      return {
        fullTranscript: text,
        language: lang,
        durationMs: (endedAt ?? Date.now()) - startTime,
        wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
      };
    };

    const stream: STTStream = {
      id: streamId,

      writeAudioChunk(chunk: Buffer | ArrayBuffer) {
        if (closed || ws.readyState !== WebSocket.OPEN) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        lastAudioAt = Date.now();
        ws.send(buf);
      },

      /**
       * Graceful end: `CloseStream` makes Deepgram transcribe the audio it
       * still holds and send the final results before closing — closing the
       * socket directly would throw away the words in progress. Waits for
       * the close (at most FINALIZE_TIMEOUT_MS).
       */
      end(): Promise<STTFinalResult> {
        closeRequested = true;
        endedAt ??= Date.now();
        clearInterval(keepAlive);
        return new Promise((resolve) => {
          if (closed || ws.readyState !== WebSocket.OPEN) {
            closed = true;
            resolve(result());
            return;
          }
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            ws.removeListener("close", finish);
            closed = true;
            resolve(result());
          };
          const timer = setTimeout(() => {
            logger.warn("Deepgram did not close after CloseStream", {
              streamId,
            });
            try {
              ws.close(1000, "stream ended");
            } catch {
              /* ignore */
            }
            finish();
          }, FINALIZE_TIMEOUT_MS);
          ws.on("close", finish);
          try {
            ws.send(JSON.stringify({ type: "CloseStream" }));
          } catch {
            finish();
          }
        });
      },

      close() {
        closeRequested = true;
        clearInterval(keepAlive);
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
        this.logger.debug("Message received", {
          type: msg.type,
          isFinal: msg.is_final,
        });

        if (msg.type === "Results" && msg.channel) {
          const transcript = msg.channel.alternatives[0]?.transcript || "";
          const isFinal = msg.is_final === true || msg.speech_final === true;
          if (isFinal) pendingInterim = "";
          if (!transcript) return;

          if (isFinal) {
            fullTranscript += (fullTranscript ? " " : "") + transcript;
          } else {
            pendingInterim = transcript;
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
      this.logger.info("WebSocket connected", { streamId });
    });

    ws.on("error", (err: Error) => {
      this.logger.error("WebSocket error", { error: err.message, streamId });
      clearInterval(keepAlive);
      params.onError(err);
      closed = true;
    });

    ws.on("close", (code: number, reasonBuffer: Buffer) => {
      clearInterval(keepAlive);
      const reason = reasonBuffer?.toString() || "";
      const wasClosed = closed;
      closed = true;
      if (closeRequested || wasClosed) return;
      // Deepgram (or the network) ended the stream on its own.
      this.logger.warn("Deepgram closed the stream unexpectedly", {
        streamId,
        code,
        reason,
      });
      params.onUnexpectedClose?.({ code, reason });
    });

    return stream;
  }
}
