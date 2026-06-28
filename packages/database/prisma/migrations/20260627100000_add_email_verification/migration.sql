-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3),
ADD COLUMN "verificationCode" TEXT,
ADD COLUMN "verificationExpires" TIMESTAMP(3);
