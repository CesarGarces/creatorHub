/**
 * Plays Robotina's voice: the Aura-2 audio segments of a reply, gapless and
 * in order, as they arrive (the first sentence plays while the model is
 * still writing the rest).
 *
 * Web Audio: each segment is decoded and scheduled right after the previous
 * one; everything goes through an AnalyserNode whose level drives the orb's
 * waves. `stop()` silences at once (barge-in). Segments are kept by the
 * caller for replay. Without Web Audio (old browsers, tests) the player is
 * silent and reports the end right away, so the conversation goes on.
 */

export interface SpeechSegment {
  /** Encoded audio (MP3 from Deepgram). */
  data: ArrayBuffer;
  mimeType: string;
  durationMs: number;
}

type AudioContextFactory = () => AudioContext;

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function defaultFactory(): AudioContextFactory | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return Ctor ? () => new Ctor() : null;
}

export class SpeechPlayer {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelBuffer: Float32Array<ArrayBuffer> | null = null;
  private readonly factory: AudioContextFactory | null;

  /** Bumped by stop(): decodes of an older reply are dropped. */
  private generation = 0;
  private chain: Promise<void> = Promise.resolve();
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private pending = 0;
  private finished = true;
  /** The end of the current reply was reported (or there is no reply). */
  private endNotified = true;
  private endListeners = new Set<() => void>();
  private startListeners = new Set<() => void>();

  constructor(factory?: AudioContextFactory | null) {
    this.factory = factory === undefined ? defaultFactory() : factory;
  }

  /** Whether the browser can play (Web Audio available). */
  get isSupported(): boolean {
    return this.factory !== null;
  }

  /** Something is playing or waiting to play. */
  get isActive(): boolean {
    return this.sources.size > 0 || this.pending > 0;
  }

  /**
   * Creates/resumes the audio context. Call from a user gesture (tap on the
   * orb, send, mic): browsers only allow sound after one.
   */
  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (context && context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        // Still blocked: playback will start on the next gesture.
      }
    }
  }

  /** A new reply starts: segments will follow until `finish()`. */
  begin(): void {
    this.stop();
    this.finished = false;
    this.endNotified = false;
  }

  /** Queues a segment; it plays right after the previous one. */
  enqueue(segment: SpeechSegment): void {
    const context = this.ensureContext();
    if (!context) return;
    const generation = this.generation;
    this.pending += 1;
    this.chain = this.chain
      .then(async () => {
        const buffer = await context.decodeAudioData(segment.data.slice(0));
        if (generation !== this.generation) return;
        this.schedule(context, buffer);
      })
      .catch(() => {
        // Undecodable segment: skip it, keep the rest of the reply.
      })
      .finally(() => {
        if (generation !== this.generation) return;
        this.pending -= 1;
        this.maybeEnd();
      });
  }

  /** No more segments for this reply: `onEnd` fires after the last one. */
  finish(): void {
    this.finished = true;
    this.maybeEnd();
  }

  /** Plays saved segments again (replay button). */
  replay(segments: SpeechSegment[]): void {
    this.begin();
    for (const segment of segments) this.enqueue(segment);
    this.finish();
  }

  /** Silences everything now and forgets queued segments. */
  stop(): void {
    this.generation += 1;
    this.chain = Promise.resolve();
    this.pending = 0;
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    this.nextStart = 0;
    this.finished = true;
    this.endNotified = true; // interrupted: not an "end"
  }

  /** Loudness of what is playing (0–1), for the orb. */
  level(): number {
    const analyser = this.analyser;
    if (!analyser || this.sources.size === 0) return 0;
    const data =
      this.levelBuffer ??
      (this.levelBuffer = new Float32Array(analyser.fftSize));
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
    return Math.min(1, Math.sqrt(sum / data.length) * 4);
  }

  /** Called when the first segment of a reply starts playing. */
  onStart(listener: () => void): () => void {
    this.startListeners.add(listener);
    return () => this.startListeners.delete(listener);
  }

  /** Called when a finished reply has been fully played (or there was nothing to play). */
  onEnd(listener: () => void): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  dispose(): void {
    this.stop();
    this.endListeners.clear();
    this.startListeners.clear();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.analyser = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.context || !this.factory) return this.context;
    try {
      const context = this.factory();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.connect(context.destination);
      this.context = context;
      this.analyser = analyser;
    } catch {
      return null;
    }
    return this.context;
  }

  private schedule(context: AudioContext, buffer: AudioBuffer): void {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser ?? context.destination);
    const startAt = Math.max(context.currentTime + 0.02, this.nextStart);
    this.nextStart = startAt + buffer.duration;
    const first = this.sources.size === 0;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      this.maybeEnd();
    };
    source.start(startAt);
    if (first) this.startListeners.forEach((listener) => listener());
  }

  private maybeEnd(): void {
    if (!this.finished || this.isActive || this.endNotified) return;
    this.endNotified = true;
    this.nextStart = 0;
    this.endListeners.forEach((listener) => listener());
  }
}
