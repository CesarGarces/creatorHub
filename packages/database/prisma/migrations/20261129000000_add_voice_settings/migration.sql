-- Voice settings (Admin → Voice: STT & TTS): Deepgram STT model, the Aura
-- voice of each language and the prices per second. A single "global" row,
-- created with the defaults (Nova-3, 1 credit/s in; Andromeda, Celeste and
-- Bianca on Aura-2, 2 credits/s out).

-- CreateTable
CREATE TABLE "VoiceSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "sttModel" TEXT NOT NULL DEFAULT 'nova-3',
    "sttCreditsPerSecond" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ttsCreditsPerSecond" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "ttsVoices" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSettings_pkey" PRIMARY KEY ("id")
);

-- Default row
INSERT INTO "VoiceSettings" ("id", "ttsVoices", "updatedAt")
VALUES (
    'global',
    '{"en":{"model":"aura-2","voice":"aura-2-andromeda-en"},"es":{"model":"aura-2","voice":"aura-2-celeste-es"},"pt":{"model":"aura-2","voice":"aura-2-bianca-pt"}}',
    CURRENT_TIMESTAMP
);
