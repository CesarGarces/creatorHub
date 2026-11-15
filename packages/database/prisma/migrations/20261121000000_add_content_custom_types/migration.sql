-- AlterTable
ALTER TABLE "ContentEvent" ADD COLUMN "customTypeId" TEXT;

-- CreateTable
CREATE TABLE "ContentCustomType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentCustomType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentEvent_customTypeId_idx" ON "ContentEvent"("customTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentCustomType_userId_name_key" ON "ContentCustomType"("userId", "name");

-- AddForeignKey
ALTER TABLE "ContentEvent" ADD CONSTRAINT "ContentEvent_customTypeId_fkey" FOREIGN KEY ("customTypeId") REFERENCES "ContentCustomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCustomType" ADD CONSTRAINT "ContentCustomType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
