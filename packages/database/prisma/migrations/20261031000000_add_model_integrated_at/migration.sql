-- Add model integration date.
-- Existing rows are backfilled with the migration timestamp (today).
-- New rows receive the current timestamp at creation time.

-- AlterTable
ALTER TABLE "ModelMetadata" ADD COLUMN "integratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ModelMetadata_integratedAt_idx" ON "ModelMetadata"("integratedAt");
