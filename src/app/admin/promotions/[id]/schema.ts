import { z } from "zod";
import { parisDateTimeLocalSchema } from "@/lib/timezone";

export const createChangeSessionSchema = z
  .object({
    weekNumber: z.coerce.number().int().positive(),
    opensAt: parisDateTimeLocalSchema,
    closesAt: parisDateTimeLocalSchema,
    maxChangesPerParticipant: z.coerce.number().int().positive(),
  })
  .refine((data) => data.closesAt > data.opensAt, {
    error: "La fermeture doit être après l'ouverture",
    path: ["closesAt"],
  });
