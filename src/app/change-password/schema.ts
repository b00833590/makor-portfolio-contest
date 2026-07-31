import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(4, "Le nouveau mot de passe doit contenir au moins 4 caractères"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Les deux mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });
