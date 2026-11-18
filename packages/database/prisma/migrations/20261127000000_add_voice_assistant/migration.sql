-- Robotina — AI voice assistant (tool "voice-assistant"). Text only: the
-- Aura-2 audio is streamed to the browser and never stored.

-- CreateTable
CREATE TABLE "VoiceConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "spoken" BOOLEAN NOT NULL DEFAULT false,
    "voice" TEXT,
    "audioMs" INTEGER NOT NULL DEFAULT 0,
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "interrupted" BOOLEAN NOT NULL DEFAULT false,
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceConversation_userId_updatedAt_idx" ON "VoiceConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "VoiceMessage_conversationId_createdAt_idx" ON "VoiceMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "VoiceConversation" ADD CONSTRAINT "VoiceConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "VoiceConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
