-- AlterTable: Add likeCount and viewCount to GeneratedImage
ALTER TABLE "GeneratedImage" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GeneratedImage" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: AssetLike
CREATE TABLE "AssetLike" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint to prevent duplicate likes per asset+fingerprint
CREATE UNIQUE INDEX "AssetLike_assetId_fingerprint_key" ON "AssetLike"("assetId", "fingerprint");

-- CreateIndex: Performance indexes
CREATE INDEX "AssetLike_assetId_idx" ON "AssetLike"("assetId");
CREATE INDEX "AssetLike_fingerprint_idx" ON "AssetLike"("fingerprint");
CREATE INDEX "AssetLike_userId_idx" ON "AssetLike"("userId");
CREATE INDEX "AssetLike_createdAt_idx" ON "AssetLike"("createdAt");

-- AddForeignKey: AssetLike -> GeneratedImage
ALTER TABLE "AssetLike" ADD CONSTRAINT "AssetLike_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "GeneratedImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AssetLike -> User (optional)
ALTER TABLE "AssetLike" ADD CONSTRAINT "AssetLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
