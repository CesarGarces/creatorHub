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
ALTER TABLE "SocialResearchSession" ADD CONSTRAINT "SocialResearchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialResearchMessage" ADD CONSTRAINT "SocialResearchMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SocialResearchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
