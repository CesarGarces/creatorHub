-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PAY_AS_YOU_GO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "MarketingEventType" AS ENUM ('CREDIT_THRESHOLD_75', 'CREDIT_THRESHOLD_25', 'CREDIT_THRESHOLD_10', 'CREDIT_THRESHOLD_5', 'CREDIT_DEPLETED');

-- AlterTable: Add plan, freeCredits, purchasedCredits to User
ALTER TABLE "User" ADD COLUMN "plan" "UserPlan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "User" ADD COLUMN "freeCredits" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "User" ADD COLUMN "purchasedCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add isProModel to GeneratedImage
ALTER TABLE "GeneratedImage" ADD COLUMN "isProModel" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MarketingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MarketingEventType" NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable (CreditBalance was removed from schema)
DROP TABLE IF EXISTS "CreditBalance";
