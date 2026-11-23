-- Voice prices are configured per minute instead of per second.
ALTER TABLE "VoiceSettings" RENAME COLUMN "sttCreditsPerSecond" TO "sttCreditsPerMinute";
ALTER TABLE "VoiceSettings" RENAME COLUMN "ttsCreditsPerSecond" TO "ttsCreditsPerMinute";
ALTER TABLE "VoiceSettings" ALTER COLUMN "sttCreditsPerMinute" SET DEFAULT 60;
ALTER TABLE "VoiceSettings" ALTER COLUMN "ttsCreditsPerMinute" SET DEFAULT 120;
-- Keep the same effective prices for values already saved per second.
UPDATE "VoiceSettings"
SET "sttCreditsPerMinute" = "sttCreditsPerMinute" * 60,
    "ttsCreditsPerMinute" = "ttsCreditsPerMinute" * 60;
