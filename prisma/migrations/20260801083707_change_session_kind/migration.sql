-- CreateEnum
CREATE TYPE "ChangeSessionKind" AS ENUM ('INITIALIZATION', 'WEEKLY');

-- AlterTable
ALTER TABLE "ChangeSession" ADD COLUMN     "kind" "ChangeSessionKind" NOT NULL DEFAULT 'WEEKLY';
