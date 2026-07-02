-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('X_TWITTER', 'YOUTUBE', 'TWITCH', 'INSTAGRAM', 'TIKTOK');

-- CreateEnum
CREATE TYPE "SocialAccountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "TweetDraftStatus" AS ENUM ('DRAFT', 'PREVIEW', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerUsername" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SocialAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TweetDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socialAccountId" TEXT,
    "content" TEXT NOT NULL,
    "topic" TEXT,
    "researchData" JSONB,
    "styleProfileId" TEXT,
    "status" "TweetDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedTweetId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TweetDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialResearchSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialResearchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialResearchMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "resultData" JSONB,
    "provider" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialResearchMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendCache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_userId_provider_key" ON "SocialAccount"("userId", "provider");

-- CreateIndex
CREATE INDEX "SocialAccount_userId_idx" ON "SocialAccount"("userId");

-- CreateIndex
CREATE INDEX "SocialAccount_provider_status_idx" ON "SocialAccount"("provider", "status");

-- CreateIndex
CREATE INDEX "TweetDraft_userId_createdAt_idx" ON "TweetDraft"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TweetDraft_userId_status_idx" ON "TweetDraft"("userId", "status");

-- CreateIndex
CREATE INDEX "SocialResearchSession_userId_toolId_idx" ON "SocialResearchSession"("userId", "toolId");

-- CreateIndex
CREATE INDEX "SocialResearchSession_userId_idx" ON "SocialResearchSession"("userId");

-- CreateIndex
CREATE INDEX "SocialResearchMessage_sessionId_idx" ON "SocialResearchMessage"("sessionId");

-- CreateIndex
CREATE INDEX "SocialResearchMessage_sessionId_createdAt_idx" ON "SocialResearchMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrendCache_queryHash_provider_key" ON "TrendCache"("queryHash", "provider");

-- CreateIndex
CREATE INDEX "TrendCache_queryHash_provider_idx" ON "TrendCache"("queryHash", "provider");

-- CreateIndex
CREATE INDEX "TrendCache_expiresAt_idx" ON "TrendCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TweetDraft" ADD CONSTRAINT "TweetDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TweetDraft" ADD CONSTRAINT "TweetDraft_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialResearchSession" ADD CONSTRAINT "SocialResearchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialResearchMessage" ADD CONSTRAINT "SocialResearchMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SocialResearchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
