-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_REMINDER';

-- AlterTable
ALTER TABLE "ContentEvent" ADD COLUMN "reminderMinutes" INTEGER DEFAULT 15,
ADD COLUMN "remindAt" TIMESTAMP(3),
ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Existing sessions get the default reminder (15 minutes before they start).
UPDATE "ContentEvent"
SET "remindAt" = "startAt" - ("reminderMinutes" * INTERVAL '1 minute')
WHERE "reminderMinutes" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ContentEvent_remindAt_idx" ON "ContentEvent"("remindAt");
