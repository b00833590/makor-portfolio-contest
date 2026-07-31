import { z } from "zod";

export const addParticipantSchema = z.object({
  email: z.email("Adresse email invalide"),
  promotionId: z.string().min(1, "Choisissez une promotion"),
});
