-- Élargit la précision décimale des prix et quantités.
--
-- Motif : en Decimal(18, 6), un actif micro-cap (memecoin coté ~0,000003 €)
-- n'a pas de 7e décimale ; son pas d'arrondi (0,000001 €) vaut ~33 % du prix.
-- La valeur d'une position sur un tel actif bondissait de ±33 % à chaque
-- franchissement de quantum, faussant le portefeuille et le classement.
-- Decimal(24, 12) ramène l'erreur d'arrondi sous 1e-4 % pour tout prix > 1e-8 €.
--
-- Postgres réécrit chaque table concernée (verrou ACCESS EXCLUSIVE le temps de
-- la réécriture). Volumétrie actuelle : Price ~1e5 lignes, Position / Transaction
-- ~1e3 — réécriture de l'ordre de la seconde. Les valeurs existantes sont
-- conservées à l'identique (ajout de zéros de poids faible uniquement).

ALTER TABLE "Price"
  ALTER COLUMN "price" TYPE DECIMAL(24, 12);

ALTER TABLE "Position"
  ALTER COLUMN "quantity" TYPE DECIMAL(30, 12),
  ALTER COLUMN "avgEntryPrice" TYPE DECIMAL(24, 12);

ALTER TABLE "Transaction"
  ALTER COLUMN "quantity" TYPE DECIMAL(30, 12),
  ALTER COLUMN "price" TYPE DECIMAL(24, 12);
