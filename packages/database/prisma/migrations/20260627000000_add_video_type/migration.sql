-- CreateEnum
CREATE TYPE "GeneratedAssetType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable: Add type column with default for existing rows
ALTER TABLE "GeneratedImage" ADD COLUMN "type" "GeneratedAssetType" NOT NULL DEFAULT 'IMAGE';

-- Update existing records (safety net)
UPDATE "GeneratedImage" SET "type" = 'IMAGE' WHERE "type" IS NULL;
