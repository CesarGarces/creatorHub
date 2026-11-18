import {
  TTS_CREDITS_PER_MINUTE,
  VOICE_ASSISTANT_REPLY_CREDITS,
} from "@creator-hub/shared-types";

/**
 * Credits for one Robotina reply:
 * - written reply → 1 credit ("one shot");
 * - spoken reply → 1 credit per started minute of Aura-2 speech
 *   (≤ 1 min → 1, ≤ 2 min → 2…);
 * - nothing said or written (cancelled before the first word) → 0.
 *
 * Voice *input* is not included: the STT gateway bills it per minute, like
 * every voice button of the platform.
 */
export function replyCredits(reply: {
  hasContent: boolean;
  audioMs: number;
}): number {
  if (reply.audioMs > 0) {
    return (
      Math.max(1, Math.ceil(reply.audioMs / 60_000)) * TTS_CREDITS_PER_MINUTE
    );
  }
  return reply.hasContent ? VOICE_ASSISTANT_REPLY_CREDITS : 0;
}
