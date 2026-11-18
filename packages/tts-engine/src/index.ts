export { TTSEngineModule } from "./tts-engine.module";
export { TTSEngineService } from "./tts-engine.service";
export { TTSProviderRegistry } from "./providers/tts-provider.registry";
export { TTSProviderFactory } from "./providers/tts-provider.factory";
export {
  DeepgramTTSProvider,
  DeepgramTTSError,
  DEEPGRAM_SPEAK_URL,
} from "./providers/deepgram-tts.provider";
export { MockTTSProvider } from "./providers/mock-tts.provider";
export {
  mp3DurationMs,
  wavDurationMs,
  silentWav,
  estimateSpeechMs,
} from "./audio-format";
export type { TTSProviderInterface } from "./providers/tts-provider.interface";
