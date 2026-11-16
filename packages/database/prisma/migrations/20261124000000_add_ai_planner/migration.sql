-- CreateEnum
CREATE TYPE "ContentAiPlanStatus" AS ENUM ('ANALYZED', 'APPLIED');

-- AlterTable
ALTER TABLE "ModelMetadata" ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContentEvent" ADD COLUMN "toolAction" JSONB;

-- CreateTable
CREATE TABLE "ContentAiPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "status" "ContentAiPlanStatus" NOT NULL DEFAULT 'ANALYZED',
    "title" TEXT NOT NULL,
    "complexity" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "inputSummary" JSONB,
    "creditsCharged" INTEGER NOT NULL,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAiPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embedding" REAL[],
    "embeddingModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentAiPlan_userId_createdAt_idx" ON "ContentAiPlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentKnowledgeChunk_userId_embeddingModel_idx" ON "ContentKnowledgeChunk"("userId", "embeddingModel");

-- CreateIndex
CREATE UNIQUE INDEX "ContentKnowledgeChunk_source_key" ON "ContentKnowledgeChunk"("userId", "sourceType", "sourceId", "embeddingModel");

-- AddForeignKey
ALTER TABLE "ContentAiPlan" ADD CONSTRAINT "ContentAiPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentKnowledgeChunk" ADD CONSTRAINT "ContentKnowledgeChunk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
