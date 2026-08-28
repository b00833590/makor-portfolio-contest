-- CreateTable
CREATE TABLE "HallOfFameEntry" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "promotionName" TEXT NOT NULL,
    "finalReturnPct" DECIMAL(9,6) NOT NULL,
    "finalPnlEur" DECIMAL(18,2) NOT NULL,
    "finalRank" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallOfFameEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameEntry_promotionId_userId_key" ON "HallOfFameEntry"("promotionId", "userId");

-- CreateIndex
CREATE INDEX "HallOfFameEntry_finalReturnPct_idx" ON "HallOfFameEntry"("finalReturnPct");

-- AddForeignKey
ALTER TABLE "HallOfFameEntry" ADD CONSTRAINT "HallOfFameEntry_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameEntry" ADD CONSTRAINT "HallOfFameEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
