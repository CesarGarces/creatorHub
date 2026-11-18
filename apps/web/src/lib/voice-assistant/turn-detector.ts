/**
 * Decides when the user has finished speaking, so Robotina can answer
 * without a second tap (fluid, hands-free turns).
 *
 * Deepgram marks a phrase final (`isFinal`) after ~300 ms of silence. The
 * turn ends `afterFinalMs` (3 s) after the last final phrase if nothing new
 * is heard — long enough to pause and think mid-sentence; any new word
 * restarts the wait. Deepgram's UtteranceEnd only ends the turn when no
 * final phrase is pending (it would otherwise cut that pause short). If
 * nothing at all is said for `noSpeechMs`, the turn ends as "silence" (the
 * mic closes instead of listening forever). A tap always sends at once.
 */

export type TurnEndReason = "speech" | "silence";

export interface TurnDetectorOptions {
  afterFinalMs?: number;
  noSpeechMs?: number;
}

/** Pause after the last phrase before the message is sent. */
export const TURN_AFTER_FINAL_MS = 3000;
export const TURN_NO_SPEECH_MS = 8000;

export class TurnDetector {
  private finalTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private heard = false;
  private active = false;
  private readonly afterFinalMs: number;
  private readonly noSpeechMs: number;

  constructor(
    private readonly onTurnEnd: (reason: TurnEndReason) => void,
    options: TurnDetectorOptions = {},
  ) {
    this.afterFinalMs = options.afterFinalMs ?? TURN_AFTER_FINAL_MS;
    this.noSpeechMs = options.noSpeechMs ?? TURN_NO_SPEECH_MS;
  }

  /** Whether the user said anything in this turn. */
  get heardSpeech(): boolean {
    return this.heard;
  }

  /** The mic opened: start waiting for speech. */
  start(): void {
    this.stop();
    this.active = true;
    this.heard = false;
    this.silenceTimer = setTimeout(() => this.end("silence"), this.noSpeechMs);
  }

  /** A partial or final transcript arrived. */
  transcript(text: string, isFinal: boolean): void {
    if (!this.active || !text.trim()) return;
    this.heard = true;
    this.clear();
    if (isFinal) {
      this.finalTimer = setTimeout(() => this.end("speech"), this.afterFinalMs);
    }
  }

  /**
   * Deepgram's UtteranceEnd: the user stopped talking. Ignored while the
   * pause after a final phrase is running (that timer decides); ends the
   * turn when the last words never became final.
   */
  utteranceEnd(): void {
    if (this.active && this.heard && !this.finalTimer) this.end("speech");
  }

  stop(): void {
    this.active = false;
    this.clear();
  }

  private end(reason: TurnEndReason): void {
    if (!this.active) return;
    this.stop();
    this.onTurnEnd(reason);
  }

  private clear(): void {
    if (this.finalTimer) clearTimeout(this.finalTimer);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.finalTimer = null;
    this.silenceTimer = null;
  }
}
