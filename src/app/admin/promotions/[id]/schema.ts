import { z } from "zod";
import { parisDateTimeLocalSchema } from "@/lib/timezone";

export const createChangeSessionSchema = z
  .object({
    // 0 est réservé à la fenêtre de constitution du portefeuille (voir ChangeSessionKind.INITIALIZATION).
    weekNumber: z.coerce.number().int().min(0),
    opensAt: parisDateTimeLocalSchema,
    closesAt: parisDateTimeLocalSchema,
    maxChangesPerParticipant: z.coerce.number().int().positive(),
  })
  .refine((data) => data.closesAt > data.opensAt, {
    error: "La fermeture doit être après l'ouverture",
    path: ["closesAt"],
  });
