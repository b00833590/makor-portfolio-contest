-- CreateTable
CREATE TABLE "PromotionParticipant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionParticipant_userId_promotionId_key" ON "PromotionParticipant"("userId", "promotionId");

-- CreateIndex
CREATE INDEX "PromotionParticipant_promotionId_idx" ON "PromotionParticipant"("promotionId");

-- AddForeignKey
ALTER TABLE "PromotionParticipant" ADD CONSTRAINT "PromotionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionParticipant" ADD CONSTRAINT "PromotionParticipant_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : chaque participant actuellement rattaché à une promotion devient
-- une ligne d'inscription. gen_random_uuid() est natif Postgres 13+ ; l'id
-- n'a aucune contrainte de format côté DB, seulement la PK.
INSERT INTO "PromotionParticipant" ("id", "userId", "promotionId", "createdAt")
SELECT gen_random_uuid()::text, "id", "promotionId", CURRENT_TIMESTAMP
FROM "User"
WHERE "promotionId" IS NOT NULL;
