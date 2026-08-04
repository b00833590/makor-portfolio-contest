-- Retrait des ETF de l'univers investissable : l'enum AssetType ne conserve
-- que STOCK et CRYPTO. Postgres ne permet pas de retirer une valeur d'un
-- enum directement, il faut recréer le type.
--
-- Les actifs existants de type ETF sont convertis en STOCK avant la
-- recréation de l'enum, pour préserver leurs positions, transactions et
-- historique de prix (aucune suppression de données).

-- 1) Convertir les actifs ETF existants en STOCK.
UPDATE "Asset" SET "type" = 'STOCK' WHERE "type" = 'ETF';

-- 2) Recréer l'enum sans la valeur ETF.
ALTER TYPE "AssetType" RENAME TO "AssetType_old";
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'CRYPTO');
ALTER TABLE "Asset" ALTER COLUMN "type" TYPE "AssetType" USING ("type"::text::"AssetType");
DROP TYPE "AssetType_old";
