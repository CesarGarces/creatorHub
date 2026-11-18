-- Free plan minutes with Robotina (Admin → Voice): the limit lives in
-- VoiceSettings (no limit by default); the seconds each Free user spends
-- (their voice + hers) are counted per UTC month and in total.

-- AlterTable
ALTER TABLE "VoiceSettings" ADD COLUMN "freeTierMinutes" INTEGER,
ADD COLUMN "freeTierPeriod" TEXT NOT NULL DEFAULT 'monthly';

-- CreateTable
CREATE TABLE "VoiceUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceUsage_userId_period_key" ON "VoiceUsage"("userId", "period");

-- AddForeignKey
ALTER TABLE "VoiceUsage" ADD CONSTRAINT "VoiceUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
