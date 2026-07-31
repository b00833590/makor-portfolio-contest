import { z } from "zod";

export const createPromotionSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom est obligatoire"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    initialCapital: z.coerce.number().positive(),
    minPositionSize: z.coerce.number().positive(),
    maxPositionSize: z.coerce.number().positive(),
    maxPositions: z.coerce.number().int().positive(),
    maxCryptoAllocationPct: z.coerce.number().min(0).max(100),
    changeSessionsPerWeek: z.coerce.number().int().positive(),
    maxChangesPerSession: z.coerce.number().int().positive(),
    freezeHoursBeforeEnd: z.coerce.number().int().min(0),
  })
  .refine((data) => data.endDate > data.startDate, {
    error: "La date de fin doit être après la date de début",
    path: ["endDate"],
  })
  .refine((data) => data.maxPositionSize >= data.minPositionSize, {
    error: "La taille max doit être supérieure ou égale à la taille min",
    path: ["maxPositionSize"],
  });
