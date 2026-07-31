import { z } from "zod";
import { parseParisDateTimeLocal } from "@/lib/timezone";

/** Les champs viennent d'un <input type="datetime-local"> — interprétés comme heure de Paris, pas UTC. */
const parisDateTimeLocal = z.string().transform((value, ctx) => {
  const date = parseParisDateTimeLocal(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: "custom", message: "Date invalide" });
    return z.NEVER;
  }
  return date;
});

export const createChangeSessionSchema = z
  .object({
    weekNumber: z.coerce.number().int().positive(),
    opensAt: parisDateTimeLocal,
    closesAt: parisDateTimeLocal,
    maxChangesPerParticipant: z.coerce.number().int().positive(),
  })
  .refine((data) => data.closesAt > data.opensAt, {
    error: "La fermeture doit être après l'ouverture",
    path: ["closesAt"],
  });
