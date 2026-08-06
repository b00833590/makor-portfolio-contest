-- Refonte du système de badges : catalogue enrichi (catégories, raretés,
-- condition de déblocage affichée), notification de déblocage (UserBadge.seenAt),
-- séries de connexion (User.*StreakDays), historique de rang (PerformanceSnapshot.rank).
--
-- Aucune suppression de donnée : les 4 anciens badges (DIVERSIFICATEUR, SNIPER,
-- MAIN_DE_FER, COMEBACK) et les UserBadge déjà attribués sont conservés et
-- rétro-remplis avec des valeurs de repli plutôt que supprimés — impossible de
-- vérifier depuis cette session si des participants les ont déjà obtenus, donc
-- on ne prend pas le risque de perdre un badge déjà mérité. Le nouveau
-- catalogue (voir src/lib/gamification/badges/catalog.ts) ne réutilise pas ces
-- 4 codes ; ces lignes resteront visibles telles quelles jusqu'à un nettoyage
-- manuel ultérieur si on confirme qu'elles sont inutilisées.

-- 1) Nouveaux enums.
CREATE TYPE "BadgeCategory" AS ENUM ('PERFORMANCE', 'TRADING', 'RISK_MANAGEMENT', 'CONVICTION', 'DIVERSIFICATION', 'RANKING', 'SPECIAL_EVENT', 'DISTINCTION');
CREATE TYPE "BadgeRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- 2) Badge : nouvelles colonnes, ajoutées nullable puis rétro-remplies pour les
--    lignes existantes avant de les rendre NOT NULL (aucune valeur par défaut
--    pérenne côté Prisma — chaque nouveau badge du catalogue fournit la sienne).
ALTER TABLE "Badge" ADD COLUMN "condition" TEXT;
ALTER TABLE "Badge" ADD COLUMN "category" "BadgeCategory";
ALTER TABLE "Badge" ADD COLUMN "rarity" "BadgeRarity";

UPDATE "Badge" SET
  "condition" = 'Badge de l''ancien système, conservé pour l''historique.',
  "category" = 'SPECIAL_EVENT',
  "rarity" = 'COMMON'
WHERE "condition" IS NULL;

ALTER TABLE "Badge" ALTER COLUMN "condition" SET NOT NULL;
ALTER TABLE "Badge" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "Badge" ALTER COLUMN "rarity" SET NOT NULL;

-- 3) UserBadge.seenAt : les badges déjà attribués étaient déjà visibles dans
--    l'ancienne carte "Badges" du dashboard — on les marque vus dès leur date
--    d'obtention pour ne pas déclencher de fausses notifications rétroactives.
ALTER TABLE "UserBadge" ADD COLUMN "seenAt" TIMESTAMP(3);
UPDATE "UserBadge" SET "seenAt" = "awardedAt" WHERE "seenAt" IS NULL;

-- 4) User : séries de connexion.
ALTER TABLE "User" ADD COLUMN "lastVisitDate" DATE;
ALTER TABLE "User" ADD COLUMN "currentStreakDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "longestStreakDays" INTEGER NOT NULL DEFAULT 0;

-- 5) PerformanceSnapshot : rang du jour, nul sur les lignes historiques (pas
--    de backfill possible sans rejouer tout le calcul de classement passé).
ALTER TABLE "PerformanceSnapshot" ADD COLUMN "rank" INTEGER;
