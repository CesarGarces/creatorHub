-- Robotina's actions (e.g. a Content Planner session she created) are kept
-- with the reply that ran them.

-- AlterTable
ALTER TABLE "VoiceMessage" ADD COLUMN "actions" JSONB;
