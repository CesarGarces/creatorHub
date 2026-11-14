-- CreateEnum
CREATE TYPE "CreditEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "MarketingEventType" ADD VALUE 'CREDIT_THRESHOLD_50';

-- CreateTable
CREATE TABLE "CreditEmailTrigger" (
    "id" TEXT NOT NULL,
    "state" "MarketingEventType" NOT NULL,
    "subject" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditEmailTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditEmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerId" TEXT,
    "state" "MarketingEventType" NOT NULL,
    "credits" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "CreditEmailStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "dedupeKey" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditEmailTrigger_state_key" ON "CreditEmailTrigger"("state");

-- CreateIndex
CREATE UNIQUE INDEX "CreditEmailLog_dedupeKey_key" ON "CreditEmailLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "CreditEmailLog_createdAt_idx" ON "CreditEmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "CreditEmailLog_userId_createdAt_idx" ON "CreditEmailLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreditEmailLog" ADD CONSTRAINT "CreditEmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEmailLog" ADD CONSTRAINT "CreditEmailLog_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "CreditEmailTrigger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
