import { z } from "zod";

const promotionFieldsSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  initialCapital: z.coerce.number().positive(),
  minPositionSize: z.coerce.number().positive(),
  maxPositionSize: z.coerce.number().positive(),
  maxPositions: z.coerce.number().int().positive(),
  maxCryptoPositions: z.coerce.number().int().min(0),
  changeSessionsPerWeek: z.coerce.number().int().positive(),
  maxChangesPerSession: z.coerce.number().int().positive(),
  freezeHoursBeforeEnd: z.coerce.number().int().min(0),
  initializationWindowHours: z.coerce.number().positive(),
});

function withPromotionRefinements<T extends typeof promotionFieldsSchema>(schema: T) {
  return schema
    .refine((data) => data.endDate > data.startDate, {
      error: "La date de fin doit être après la date de début",
      path: ["endDate"],
    })
    .refine((data) => data.maxPositionSize >= data.minPositionSize, {
      error: "La taille max doit être supérieure ou égale à la taille min",
      path: ["maxPositionSize"],
    });
}

export const createPromotionSchema = withPromotionRefinements(promotionFieldsSchema);

/**
 * Nom seulement — dates, capital, positions, cryptos, sessions... se
 * modifient depuis l'écran dédié "Paramètres" (voir [id]/parametres), qui
 * analyse l'impact d'un changement avant de l'appliquer (sessions de
 * changement qui déborderaient de la nouvelle date de fin, gel déclenché
 * immédiatement, etc.). Un seul champ n'a qu'un seul endroit où le
 * modifier, pour ne jamais avoir deux logiques divergentes sur la même
 * donnée.
 */
export const updatePromotionBasicsSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
});
