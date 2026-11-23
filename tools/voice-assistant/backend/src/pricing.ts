import { voiceCredits } from "@creator-hub/shared-types";
import { VOICE_ASSISTANT_REPLY_CREDITS } from "./voice-assistant.constants";

/**
 * Credits for one Robotina reply:
 * - written reply → 1 credit ("one shot");
 * - spoken reply → its seconds of speech at the TTS price per minute
 *   (Admin → Voice; every started second counts, rounded up to whole
 *   credits), never less than a written reply;
 * - nothing said or written (cancelled before the first word) → 0.
 *
 * Voice *input* is not included: the STT gateway bills it per minute, like
 * every voice button of the platform.
 */
export function replyCredits(reply: {
  hasContent: boolean;
  audioMs: number;
  ttsCreditsPerMinute: number;
}): number {
  if (reply.audioMs > 0) {
    return Math.max(
      VOICE_ASSISTANT_REPLY_CREDITS,
      voiceCredits(reply.audioMs, reply.ttsCreditsPerMinute),
    );
  }
  return reply.hasContent ? VOICE_ASSISTANT_REPLY_CREDITS : 0;
}
