-- DropForeignKey
ALTER TABLE "GeneratedImage" DROP CONSTRAINT "GeneratedImage_toolId_fkey";

-- AlterTable
ALTER TABLE "GeneratedImage" ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'r2',
ALTER COLUMN "toolId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
