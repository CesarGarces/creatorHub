import { prisma } from "@creator-hub/database";
import { STT_CREDITS_PER_MINUTE } from "@creator-hub/shared-types";

/** ModelMetadata.taskType whose creditCost is the voice-input price per minute. */
export const STT_TASK_TYPE = "speech-to-text";
const CACHE_MS = 60_000;

let cache: { value: number; at: number } | null = null;

/**
 * Credits per minute of voice input, as configured in Admin → AI Models
 * (the active "speech-to-text" model's credit cost). Falls back to
 * STT_CREDITS_PER_MINUTE (1) when none is configured or the lookup fails.
 * Cached for a minute: it is read at the end of every voice session.
 */
export async function getSttCreditsPerMinute(
  now = Date.now(),
): Promise<number> {
  if (cache && now - cache.at < CACHE_MS) return cache.value;
  let value = STT_CREDITS_PER_MINUTE;
  try {
    const model = await prisma.modelMetadata.findFirst({
      where: { taskType: STT_TASK_TYPE, isActive: true },
      orderBy: { updatedAt: "desc" },
      select: { creditCost: true },
    });
    if (model) value = model.creditCost;
  } catch {
    // Keep the default price; billing must not fail because of pricing lookup.
  }
  cache = { value, at: now };
  return value;
}

/** Tests only. */
export function __resetSttPricingCache(): void {
  cache = null;
}
