import { z } from "zod";

export const createParticipantSchema = z.object({
  name: z.string().trim().min(2, "Identifiant trop court (Prénom Nom)"),
  password: z.string().min(4, "Le mot de passe doit contenir au moins 4 caractères"),
  promotionId: z.string().min(1, "Choisissez une promotion"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(4, "Le mot de passe doit contenir au moins 4 caractères"),
});

export const reassignPromotionSchema = z.object({
  userId: z.string().min(1),
  promotionId: z.string().min(1, "Choisissez une promotion"),
});
