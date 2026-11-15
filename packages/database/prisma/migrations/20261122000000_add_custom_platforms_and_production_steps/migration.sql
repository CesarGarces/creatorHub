-- AlterTable
ALTER TABLE "ContentCustomType" ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'tag';

-- AlterTable
ALTER TABLE "ContentProject" ADD COLUMN "customPlatformId" TEXT;

-- CreateTable
CREATE TABLE "ContentCustomPlatform" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentCustomPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentProductionStep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "baseType" "ContentEventType",
    "name" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isPublish" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContentProductionStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentProject_customPlatformId_idx" ON "ContentProject"("customPlatformId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentCustomPlatform_userId_name_key" ON "ContentCustomPlatform"("userId", "name");

-- CreateIndex
CREATE INDEX "ContentProductionStep_userId_position_idx" ON "ContentProductionStep"("userId", "position");

-- AddForeignKey
ALTER TABLE "ContentProject" ADD CONSTRAINT "ContentProject_customPlatformId_fkey" FOREIGN KEY ("customPlatformId") REFERENCES "ContentCustomPlatform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCustomPlatform" ADD CONSTRAINT "ContentCustomPlatform_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProductionStep" ADD CONSTRAINT "ContentProductionStep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
