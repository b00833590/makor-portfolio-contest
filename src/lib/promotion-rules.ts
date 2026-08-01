import { z } from "zod";

/**
 * Versionné par Promotion (stocké en JSON) — cf. docs/CONCEPTION.md section 6.
 * Changer les règles d'une saison n'affecte jamais l'historique des saisons précédentes.
 */
export const promotionRulesSchema = z.object({
  minPositionSize: z.number().positive(),
  maxPositionSize: z.number().positive(),
  maxPositions: z.number().int().positive(),
  maxCryptoPositions: z.number().int().min(0),
  changeSessionsPerWeek: z.number().int().positive(),
  maxChangesPerSession: z.number().int().positive(),
  freezeHoursBeforeEnd: z.number().int().min(0),
  /** Durée (en heures) de la fenêtre de constitution du portefeuille initial,
   *  ouverte automatiquement dès le passage de la promotion au statut ACTIVE. */
  initializationWindowHours: z.number().positive(),
});

export type PromotionRules = z.infer<typeof promotionRulesSchema>;

export const defaultPromotionRules: PromotionRules = {
  minPositionSize: 25_000,
  maxPositionSize: 100_000,
  maxPositions: 20,
  maxCryptoPositions: 1,
  changeSessionsPerWeek: 2,
  maxChangesPerSession: 4,
  freezeHoursBeforeEnd: 48,
  initializationWindowHours: 4,
};
