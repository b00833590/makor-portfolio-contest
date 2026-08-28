-- AlterTable
-- Additive, non destructive: adds a nullable avatar snapshot column to the frozen
-- Hall of Fame history. Existing rows keep NULL.
ALTER TABLE "HallOfFameEntry" ADD COLUMN "avatarUrl" TEXT;
