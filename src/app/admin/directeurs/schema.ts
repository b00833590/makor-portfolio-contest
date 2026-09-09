import { z } from "zod";

export const createDirecteurSchema = z.object({
  name: z.string().trim().min(2, "Identifiant trop court (Prénom Nom)"),
});

export const resetDirecteurPasswordSchema = z.object({
  userId: z.string().min(1),
});
