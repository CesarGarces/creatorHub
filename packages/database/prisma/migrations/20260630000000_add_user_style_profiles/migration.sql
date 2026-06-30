-- CreateEnum
CREATE TYPE "ContentSampleSource" AS ENUM ('MANUAL', 'CHAT', 'TWEET', 'POST', 'IMPORT');

-- CreateTable
CREATE TABLE "UserStyleProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "vocabKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentenceLength" TEXT NOT NULL DEFAULT 'medium',
    "emojiUsage" TEXT NOT NULL DEFAULT 'moderate',
    "formalityLevel" TEXT NOT NULL DEFAULT 'casual',
    "summary" TEXT,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStyleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContentSample" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" "ContentSampleSource" NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserContentSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStyleProfile_userId_key" ON "UserStyleProfile"("userId");

-- CreateIndex
CREATE INDEX "UserContentSample_userId_isActive_idx" ON "UserContentSample"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserContentSample_userId_createdAt_idx" ON "UserContentSample"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserStyleProfile" ADD CONSTRAINT "UserStyleProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserContentSample" ADD CONSTRAINT "UserContentSample_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
