import { z } from "zod";
import { parisDateTimeLocalSchema } from "@/lib/timezone";

// weekNumber n'est plus saisi par l'admin (voir actions.ts) — ce n'est qu'un
// numéro interne auto-assigné, la fenêtre elle-même est identifiée par ses
// horaires, pas par un numéro de semaine (les sessions peuvent être ad hoc).
export const createChangeSessionSchema = z
  .object({
    opensAt: parisDateTimeLocalSchema,
    closesAt: parisDateTimeLocalSchema,
    maxChangesPerParticipant: z.coerce.number().int().positive(),
  })
  .refine((data) => data.closesAt > data.opensAt, {
    error: "La fermeture doit être après l'ouverture",
    path: ["closesAt"],
  });

const MAX_RULES_TEXT_LENGTH = 10_000;

export const updateRulesTextSchema = z.object({
  rulesIntro: z.string().trim().max(MAX_RULES_TEXT_LENGTH).optional(),
  rulesCustomNotes: z.string().trim().max(MAX_RULES_TEXT_LENGTH).optional(),
});
