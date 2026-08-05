import { z } from "zod";

export const createParticipantSchema = z.object({
  name: z.string().trim().min(2, "Identifiant trop court (Prénom Nom)"),
  promotionId: z.string().min(1, "Choisissez une promotion"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
});

export const reassignPromotionSchema = z.object({
  userId: z.string().min(1),
  promotionId: z.string().min(1, "Choisissez une promotion"),
});
