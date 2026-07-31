import { z } from "zod";

export const createChangeSessionSchema = z
  .object({
    weekNumber: z.coerce.number().int().positive(),
    opensAt: z.coerce.date(),
    closesAt: z.coerce.date(),
    maxChangesPerParticipant: z.coerce.number().int().positive(),
  })
  .refine((data) => data.closesAt > data.opensAt, {
    error: "La fermeture doit être après l'ouverture",
    path: ["closesAt"],
  });
